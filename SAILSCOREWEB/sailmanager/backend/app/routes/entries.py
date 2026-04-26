# app/routes/entries.py
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, and_, case, cast, Integer
from datetime import datetime
import secrets, os
import unicodedata
import re
from traceback import print_exc
from typing import Optional, List, Tuple

from app.database import SessionLocal
from app import models, schemas
from utils.auth_utils import (
    get_current_user,
    get_current_user_optional,
    hash_password,
    get_current_regatta_id_optional as _get_current_regatta_id_optional,
)
from app.org_scope import assert_staff_regatta_access, assert_user_can_manage_org_id
from app.jury_scope import assert_jury_regatta_access
from app.services.email import send_email  # usa SMTP/LOG conforme .env

router = APIRouter()

PROVISION_MODE = os.getenv("ACCOUNT_PROVISIONING_MODE", "temp_password").lower()
FRONTEND_BASE = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
CLUB_NAME = os.getenv("DEFAULT_CLUB_NAME", "SailScore")
REPLY_TO = os.getenv("DEFAULT_CLUB_REPLY_TO", "")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _online_entry_limit_context(regatta: models.Regatta, class_name: str) -> Tuple[Optional[str], Optional[int]]:
    """
    Mesma regra que create_entry: limite por classe (JSON) ou legado global.
    Devolve (scope, limit) com scope 'class' | 'global' | None; limit inteiro ou None se não há cap aplicável.
    """
    by_class = getattr(regatta, "online_entry_limits_by_class", None) or {}
    class_limit_cfg = None
    if isinstance(by_class, dict) and class_name:
        class_limit_cfg = by_class.get(class_name)
        if class_limit_cfg is None:
            target = (class_name or "").strip().lower()
            for key, value in by_class.items():
                if str(key).strip().lower() == target:
                    class_limit_cfg = value
                    break
    if isinstance(class_limit_cfg, dict) and bool(class_limit_cfg.get("enabled")):
        raw_limit = class_limit_cfg.get("limit")
        if raw_limit is not None:
            lim = int(raw_limit)
            if lim >= 0:
                return ("class", lim)
    if getattr(regatta, "online_entry_limit_enabled", False) and getattr(regatta, "online_entry_limit", None) is not None:
        lim = int(regatta.online_entry_limit)
        if lim >= 0:
            return ("global", lim)
    return (None, None)


def _count_active_entries_for_limit(
    db: Session, regatta_id: int, scope: str, class_name: str
) -> int:
    q = (
        db.query(models.Entry)
        .filter(models.Entry.regatta_id == regatta_id)
        .filter(models.Entry.waiting_list == False)  # noqa: E712
    )
    if scope == "class":
        q = q.filter(func.lower(func.trim(models.Entry.class_name)) == func.lower((class_name or "").strip()))
    return q.count()


def _entry_list_order():
    """Ordenação padrão da entry list: classe -> país -> número de vela crescente."""
    sail_trim = func.trim(models.Entry.sail_number)
    # Números de vela puramente numéricos primeiro (ordem numérica), depois restantes valores.
    sail_is_numeric = sail_trim.op("GLOB")("[0-9]*")
    sail_number_int = cast(sail_trim, Integer)
    return (
        func.lower(func.trim(models.Entry.class_name)),
        func.upper(func.trim(models.Entry.boat_country_code)),
        case((sail_is_numeric, 0), else_=1),
        sail_number_int.asc(),
        func.lower(sail_trim).asc(),
        func.lower(func.trim(models.Entry.last_name)).asc(),
        func.lower(func.trim(models.Entry.first_name)).asc(),
    )


def _assert_scorer_can_manage_regatta(db: Session, current_user: models.User, regatta_id: int) -> None:
    if current_user.role != "scorer":
        return
    assert_staff_regatta_access(db, current_user, regatta_id)


def _assert_scorer_can_manage_entry(db: Session, current_user: models.User, entry: models.Entry) -> None:
    if current_user.role != "scorer":
        return
    _assert_scorer_can_manage_regatta(db, current_user, entry.regatta_id)

# ---------------- LIST /entries ----------------
@router.get("", response_model=List[schemas.EntryListRead])   # <— sem barra
@router.get("/", response_model=List[schemas.EntryListRead])  # <— com barra
def list_entries(
    regatta_id: Optional[int] = Query(None, description="Filtrar por regata."),
    mine: bool = Query(False, description="Se true, devolve apenas as tuas entries."),
    class_name: Optional[str] = Query(None, alias="class", description="Filtra por classe (opcional)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    current_regatta_id: Optional[int] = Depends(_get_current_regatta_id_optional),
):
    q = db.query(models.Entry)

    # Admin / platform_admin
    if current_user.role in ("admin", "platform_admin"):
        if regatta_id is not None:
            q = q.filter(models.Entry.regatta_id == regatta_id)
        if mine:
            q = q.filter(models.Entry.user_id == current_user.id)
        if class_name:
            q = q.filter(models.Entry.class_name == class_name)
        return q.order_by(*_entry_list_order()).all()

    if current_user.role == "jury":
        raise HTTPException(
            status_code=400,
            detail="Usa /entries/by_regatta/{regatta_id} para listagens gerais.",
        )

    # Regatista (mine): só regata do token; regatta_id na query não pode contradizer o token
    if mine:
        if current_user.role != "regatista":
            raise HTTPException(status_code=403, detail="Acesso negado")
        rid = current_regatta_id
        if regatta_id is not None and rid is not None and int(regatta_id) != int(rid):
            raise HTTPException(status_code=403, detail="Fora do âmbito da tua regata")
        if rid is None:
            return []
        reg = db.query(models.Regatta).filter(models.Regatta.id == rid).first()
        if not reg:
            return []
        if int(reg.organization_id) != int(current_user.organization_id):
            raise HTTPException(
                status_code=403,
                detail="Sem permissão nesta regata (organização).",
            )
        q = (
            q.filter(models.Entry.regatta_id == rid)
            .filter(
                or_(
                    models.Entry.user_id == current_user.id,
                    func.lower(models.Entry.email) == func.lower(current_user.email),
                )
            )
        )
        if class_name:
            q = q.filter(models.Entry.class_name == class_name)
        return q.order_by(*_entry_list_order()).all()

    # Regatista a pedir geral
    raise HTTPException(status_code=400, detail="Usa /entries/by_regatta/{regatta_id} para listagens gerais.")

# ---------------- COUNT /entries ----------------
@router.get("/count/by_regatta/{regatta_id}")
def count_entries_by_regatta(
    regatta_id: int,
    class_name: Optional[str] = Query(None, alias="class"),
    include_waiting: bool = Query(False, description="Se true, devolve também o nº de waiting list."),
    db: Session = Depends(get_db),
):
    q = db.query(models.Entry).filter(models.Entry.regatta_id == regatta_id)
    if class_name:
        q = q.filter(func.lower(func.trim(models.Entry.class_name)) == func.lower(func.trim(class_name)))

    active_count = q.filter(models.Entry.waiting_list == False).count()  # noqa: E712
    if not include_waiting:
        return {"regatta_id": regatta_id, "class_name": class_name, "active_count": active_count}

    waiting_count = q.filter(models.Entry.waiting_list == True).count()  # noqa: E712
    return {
        "regatta_id": regatta_id,
        "class_name": class_name,
        "active_count": active_count,
        "waiting_count": waiting_count,
        "total_count": active_count + waiting_count,
    }

# ---------------- helpers ----------------
def _norm_country_code(v: Optional[str]) -> str:
    return ((v or "").strip().upper() or "")

def _entry_duplicate_sail(
    db: Session,
    regatta_id: int,
    class_name: str,
    boat_country_code: Optional[str],
    sail_number: str,
    exclude_entry_id: Optional[int] = None,
) -> bool:
    """True se já existir outra entry na mesma regata+classe com o mesmo country code + sail number."""
    if not (class_name and (sail_number or "").strip()):
        return False
    code = _norm_country_code(boat_country_code)
    q = (
        db.query(models.Entry.id)
        .filter(models.Entry.regatta_id == regatta_id)
        .filter(func.lower(func.trim(models.Entry.class_name)) == func.lower(class_name.strip()))
        .filter(func.lower(func.trim(models.Entry.sail_number)) == func.lower((sail_number or "").strip()))
    )
    if code:
        q = q.filter(func.upper(func.trim(models.Entry.boat_country_code)) == code)
    else:
        q = q.filter(
            or_(
                models.Entry.boat_country_code.is_(None),
                func.trim(models.Entry.boat_country_code) == "",
            )
        )
    if exclude_entry_id is not None:
        q = q.filter(models.Entry.id != exclude_entry_id)
    return q.first() is not None

def _gen_temp_password(n: int = 10) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(n))

def _normalize_name_for_username(first: Optional[str], last: Optional[str]) -> str:
    name = f"{(first or '').strip()} {(last or '').strip()}".strip() or "sailor"
    # Remove acentos e caracteres não alfanuméricos
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"[^A-Za-z0-9]", "", name)
    return name or "sailor"


def _build_sailor_username_base(entry: schemas.EntryCreate) -> str:
    name_part = _normalize_name_for_username(entry.first_name, entry.last_name)
    sail = (entry.sail_number or "").strip().replace(" ", "")
    base = f"{name_part}{sail}" if sail else name_part
    return base or "sailor"


def _ensure_sailor_user_and_profile(db: Session, entry: schemas.EntryCreate) -> models.User:
    # Continua a ser obrigatório ter um email de contacto na entry,
    # mas já não é usado como identificador único da conta.
    contact_email = (entry.email or "").strip().lower()
    if not contact_email:
        raise HTTPException(status_code=400, detail="Email do timoneiro é obrigatório.")

    regatta_row = db.query(models.Regatta).filter(models.Regatta.id == entry.regatta_id).first()
    if not regatta_row:
        raise HTTPException(status_code=404, detail="Regatta not found")
    org_id = regatta_row.organization_id

    base_username = _build_sailor_username_base(entry)

    # Se já existir um utilizador com este username na mesma organização, reutiliza a mesma Sailor Account
    user = (
        db.query(models.User)
        .filter(models.User.username == base_username, models.User.organization_id == org_id)
        .first()
    )
    if not user:
        full_name = f"{(entry.first_name or '').strip()} {(entry.last_name or '').strip()}".strip() or None

        # Gera username único (em caso de colisão rara com outro atleta)
        username = base_username
        suffix = 1
        while (
            db.query(models.User.id)
            .filter(models.User.username == username, models.User.organization_id == org_id)
            .first()
        ):
            suffix += 1
            username = f"{base_username}{suffix}"

        # Gera um email interno técnico, mantendo o email real apenas na entry
        local = username.lower()
        internal_email = f"{local}@sailor.local"
        email_suffix = 1
        while (
            db.query(models.User.id)
            .filter(models.User.email == internal_email, models.User.organization_id == org_id)
            .first()
        ):
            email_suffix += 1
            internal_email = f"{local}{email_suffix}@sailor.local"

        user = models.User(
            organization_id=org_id,
            name=full_name,
            email=internal_email,
            username=username,
            role="regatista",
            is_active=True,
            email_verified_at=None,
        )
        # Credentials (password) are generated only when the entry is marked paid+confirmed,
        # and sent in the "Confirmed entry" email. They can change per championship.
        db.add(user)
        db.flush()
    # else: reutiliza conta existente; password pode ser definida quando entry for confirmada noutro campeonato

    prof = db.query(models.SailorProfile).filter(models.SailorProfile.user_id == user.id).first()
    if not prof:
        prof = models.SailorProfile(user_id=user.id)
        db.add(prof)

    prof.first_name = entry.first_name or prof.first_name
    prof.last_name = entry.last_name or prof.last_name
    prof.date_of_birth = entry.date_of_birth or prof.date_of_birth
    prof.gender = entry.gender or prof.gender
    prof.club = entry.club or prof.club
    prof.contact_phone_1 = entry.contact_phone_1 or prof.contact_phone_1
    prof.contact_phone_2 = entry.contact_phone_2 or prof.contact_phone_2
    prof.address = entry.address or prof.address
    prof.zip_code = entry.zip_code or prof.zip_code
    prof.town = entry.town or prof.town
    prof.country = entry.helm_country or prof.country
    prof.country_secondary = entry.helm_country_secondary or prof.country_secondary
    prof.territory = entry.territory or prof.territory
    return user


def _build_sailor_username_base_from_entry(entry: models.Entry) -> str:
    """Build username base from an existing Entry model (for get-or-create when sending confirmed email)."""
    name_part = _normalize_name_for_username(
        getattr(entry, "first_name", None),
        getattr(entry, "last_name", None),
    )
    sail = (getattr(entry, "sail_number", None) or "").strip().replace(" ", "")
    base = f"{name_part}{sail}" if sail else name_part
    return base or "sailor"


def _get_or_create_user_for_entry(db: Session, entry: models.Entry) -> models.User:
    """Return the User for this entry. If entry has no user_id, create User and SailorProfile from entry data and link."""
    if entry.user_id:
        user = db.query(models.User).filter(models.User.id == entry.user_id).first()
        if user:
            return user
    contact_email = (entry.email or "").strip().lower()
    if not contact_email:
        raise HTTPException(status_code=400, detail="Entry has no email; cannot create account.")
    regatta_row = db.query(models.Regatta).filter(models.Regatta.id == entry.regatta_id).first()
    if not regatta_row:
        raise HTTPException(status_code=404, detail="Regatta not found")
    org_id = regatta_row.organization_id
    base_username = _build_sailor_username_base_from_entry(entry)
    user = (
        db.query(models.User)
        .filter(models.User.username == base_username, models.User.organization_id == org_id)
        .first()
    )
    if not user:
        fn = getattr(entry, "first_name", None) or ""
        ln = getattr(entry, "last_name", None) or ""
        full_name = f"{str(fn).strip()} {str(ln).strip()}".strip() or None
        username = base_username
        suffix = 1
        while (
            db.query(models.User.id)
            .filter(models.User.username == username, models.User.organization_id == org_id)
            .first()
        ):
            suffix += 1
            username = f"{base_username}{suffix}"
        local = username.lower()
        internal_email = f"{local}@sailor.local"
        email_suffix = 1
        while (
            db.query(models.User.id)
            .filter(models.User.email == internal_email, models.User.organization_id == org_id)
            .first()
        ):
            email_suffix += 1
            internal_email = f"{local}{email_suffix}@sailor.local"
        user = models.User(
            organization_id=org_id,
            name=full_name,
            email=internal_email,
            username=username,
            role="regatista",
            is_active=True,
            email_verified_at=None,
        )
        db.add(user)
        db.flush()
        prof = models.SailorProfile(user_id=user.id)
        db.add(prof)
    entry.user_id = user.id
    db.commit()
    db.refresh(user)
    return user


def _get_global_setting(db: Session, key: str, organization_id: int) -> str | None:
    row = (
        db.query(models.GlobalSetting)
        .filter(
            models.GlobalSetting.organization_id == organization_id,
            models.GlobalSetting.key == key,
        )
        .first()
    )
    return row.value if row and row.value else None


def _entry_email_enabled(db: Session, organization_id: int) -> bool:
    v = _get_global_setting(db, "entry_email_enabled", organization_id)
    if v is None or v.strip() == "":
        return True
    return v.strip().lower() in ("1", "true", "yes")


def _build_entry_confirmation_email(
    db: Session,
    *,
    organization_id: int,
    sailor_name: str,
    event_name: str,
    class_name: str,
    boat_name: str,
    sail_number: str,
    helm_name: str,
    username: Optional[str] = None,
    temp_password: Optional[str] = None,
) -> tuple[str, str]:
    """Build entry application received email from configurable template."""
    from app.routes.global_settings import (
        DEFAULT_ENTRY_EMAIL_SUBJECT,
        DEFAULT_ENTRY_EMAIL_PAYMENT,
        DEFAULT_ENTRY_EMAIL_CLOSING,
    )

    subject_raw = DEFAULT_ENTRY_EMAIL_SUBJECT
    payment_instructions = _get_global_setting(db, "entry_email_payment_instructions", organization_id) or DEFAULT_ENTRY_EMAIL_PAYMENT
    closing_note = _get_global_setting(db, "entry_email_closing_note", organization_id) or DEFAULT_ENTRY_EMAIL_CLOSING
    club = _get_global_setting(db, "club_name", organization_id) or CLUB_NAME
    iban = _get_global_setting(db, "entry_fee_transfer_iban", organization_id) or ""
    contact = _get_global_setting(db, "contact_email", organization_id) or REPLY_TO or ""

    # Short and long placeholder names (replace longer first so e.g. {{event_name}} is not broken by {{event}}).
    placeholders = {
        "{{sailor_name}}": sailor_name,
        "{{sailor}}": sailor_name,
        "{{event_name}}": event_name,
        "{{event}}": event_name,
        "{{class_name}}": class_name,
        "{{class}}": class_name,
        "{{boat_name}}": boat_name,
        "{{boat}}": boat_name,
        "{{sail_number}}": sail_number,
        "{{sail}}": sail_number,
        "{{helm_name}}": helm_name,
        "{{helm}}": helm_name,
        "{{entry_fee_transfer_iban}}": iban,
        "{{iban}}": iban,
        "{{contact_email}}": contact,
        "{{contact}}": contact,
        "{{club_name}}": club,
        "{{club}}": club,
    }

    def replace_all(t: str) -> str:
        out = t
        for k in sorted(placeholders.keys(), key=len, reverse=True):
            out = out.replace(k, placeholders[k])
        return out

    subject = replace_all(subject_raw)
    payment_instructions = replace_all(payment_instructions)
    closing_note = replace_all(closing_note)

    # Fixed middle block (conditions for confirmation)
    conditions_block = (
        "Please note that this does not yet guarantee your place in the championship. "
        "Your entry will only be considered confirmed once both of the following conditions have been met:\n\n"
        "1. The entry fee has been paid\n"
        "2. The entry has been reviewed and approved by the Race Office"
    )
    confirm_followup = (
        "Once payment has been received and the Race Office has approved your entry, "
        "you will receive a further confirmation."
    )

    body = f"""Dear {sailor_name},

Thank you for registering for {event_name}.

We confirm that your entry application has been received successfully.

{conditions_block}

{payment_instructions}

Entry details

- Event: {event_name}
- Class: {class_name}
- Boat name: {boat_name}
- Sail number: {sail_number}
- Helm: {helm_name}

{confirm_followup}

{closing_note}

Kind regards,
{club}"""

    if username and temp_password:
        login_url = f"{FRONTEND_BASE}/login"
        body += f"""

---
Sailor Account access:
• Username: {username}
• Temporary password: {temp_password}

Login here: {login_url}"""

    return subject, body


def _send_combined_entry_email(
    background: BackgroundTasks,
    db: Session,
    *,
    organization_id: int,
    to_email: str,
    sailor_name: str,
    regatta_name: str,
    class_name: str,
    boat_name: str,
    sail_number: str,
    helm_name: str,
    username: Optional[str],
    temp_password: Optional[str],
):
    """Send entry confirmation email using configurable template."""
    subject, text = _build_entry_confirmation_email(
        db,
        organization_id=organization_id,
        sailor_name=sailor_name,
        event_name=regatta_name,
        class_name=class_name,
        boat_name=boat_name,
        sail_number=sail_number,
        helm_name=helm_name,
        username=username,
        temp_password=temp_password,
    )
    club = _get_global_setting(db, "club_name", organization_id) or CLUB_NAME
    reply_to = _get_global_setting(db, "contact_email", organization_id) or REPLY_TO or None

    background.add_task(
        send_email,
        to_email,
        subject,
        None,
        text,
        from_name=club,
        reply_to=reply_to,
    )


def _confirmed_entry_email_enabled(db: Session, organization_id: int) -> bool:
    v = _get_global_setting(db, "confirmed_entry_email_enabled", organization_id)
    if v is None or v.strip() == "":
        return True
    return v.strip().lower() in ("1", "true", "yes")


def _build_confirmed_entry_email(
    db: Session,
    *,
    organization_id: int,
    sailor_name: str,
    event_name: str,
    class_name: str,
    boat_name: str,
    sail_number: str,
    helm_name: str,
    username: Optional[str] = None,
    temp_password: Optional[str] = None,
) -> tuple[str, str]:
    """Build confirmed entry email (paid + confirmed). Uses configurable main_message and closing_note; appends account credentials when provided."""
    from app.routes.global_settings import (
        DEFAULT_CONFIRMED_ENTRY_SUBJECT,
        DEFAULT_CONFIRMED_ENTRY_MESSAGE,
        DEFAULT_CONFIRMED_ENTRY_CLOSING,
    )

    subject_raw = DEFAULT_CONFIRMED_ENTRY_SUBJECT
    main_message = _get_global_setting(db, "confirmed_entry_email_main_message", organization_id) or DEFAULT_CONFIRMED_ENTRY_MESSAGE
    closing_note = _get_global_setting(db, "confirmed_entry_email_closing_note", organization_id) or DEFAULT_CONFIRMED_ENTRY_CLOSING
    club = _get_global_setting(db, "club_name", organization_id) or CLUB_NAME
    contact = _get_global_setting(db, "contact_email", organization_id) or REPLY_TO or ""

    placeholders = {
        "{{sailor_name}}": sailor_name,
        "{{sailor}}": sailor_name,
        "{{event_name}}": event_name,
        "{{event}}": event_name,
        "{{class_name}}": class_name,
        "{{class}}": class_name,
        "{{boat_name}}": boat_name,
        "{{boat}}": boat_name,
        "{{sail_number}}": sail_number,
        "{{sail}}": sail_number,
        "{{helm_name}}": helm_name,
        "{{helm}}": helm_name,
        "{{contact_email}}": contact,
        "{{contact}}": contact,
        "{{club_name}}": club,
        "{{club}}": club,
    }

    def replace_all(t: str) -> str:
        out = t
        for k in sorted(placeholders.keys(), key=len, reverse=True):
            out = out.replace(k, placeholders[k])
        return out

    subject = replace_all(subject_raw)
    main_message = replace_all(main_message)
    closing_note = replace_all(closing_note)

    body = f"""Dear {sailor_name},

{main_message}

{closing_note}

Kind regards,
{club}"""

    if username and temp_password:
        login_url = f"{FRONTEND_BASE}/login"
        body += f"""

---
Sailor Account access:
• Username: {username}
• Temporary password: {temp_password}

Login here: {login_url}"""

    return subject, body


# ---------------- endpoints ----------------

@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_entry(entry: schemas.EntryCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        # === BLOQUEIO: inscrições fechadas ===
        regatta = db.query(models.Regatta).filter(models.Regatta.id == entry.regatta_id).first()
        if not regatta:
            raise HTTPException(status_code=404, detail="Regatta not found")
        if regatta.online_entry_open is False:
            raise HTTPException(status_code=403, detail="Online entry is closed for this regatta.")

        # === LIMITE: waiting list ao invés de recusar ===
        is_waiting = False
        scope, lim = _online_entry_limit_context(regatta, (entry.class_name or "").strip())
        if scope is not None and lim is not None:
            current_count = _count_active_entries_for_limit(
                db, entry.regatta_id, scope, entry.class_name or ""
            )
            if current_count >= lim:
                is_waiting = True

        user = _ensure_sailor_user_and_profile(db, entry)

        # Duplicado = mesmo número de vela + mesmo country code na mesma classe (POR 1 + POR 1 não pode; POR 1 + GBR 1 pode)
        if _entry_duplicate_sail(
            db,
            entry.regatta_id,
            entry.class_name,
            getattr(entry, "boat_country_code", None),
            entry.sail_number,
            exclude_entry_id=None,
        ):
            raise HTTPException(
                status_code=409,
                detail="Já existe uma inscrição com o mesmo número de vela e país (country code) nesta classe. Números iguais só são permitidos com países diferentes (ex.: POR 1, GBR 1).",
            )

        new_entry = models.Entry(
            class_name=entry.class_name,
            boat_country=entry.boat_country,
            boat_country_code=getattr(entry, "boat_country_code", None),
            sail_number=entry.sail_number,
            bow_number=getattr(entry, "bow_number", None),
            boat_name=entry.boat_name,
            boat_model=entry.boat_model,
            rating=entry.rating,
            rating_type=getattr(entry, "rating_type", None),
            orc_low=getattr(entry, "orc_low", None),
            orc_medium=getattr(entry, "orc_medium", None),
            orc_high=getattr(entry, "orc_high", None),
            category=entry.category,
            helm_position=getattr(entry, "helm_position", None),
            date_of_birth=entry.date_of_birth,
            gender=entry.gender,
            first_name=entry.first_name,
            last_name=entry.last_name,
            helm_country=entry.helm_country,
            territory=entry.territory,
            club=entry.club,
            email=(entry.email or "").strip().lower(),
            contact_phone_1=entry.contact_phone_1,
            contact_phone_2=entry.contact_phone_2,
            address=entry.address,
            zip_code=entry.zip_code,
            town=entry.town,
            helm_country_secondary=entry.helm_country_secondary,
            federation_license=getattr(entry, "federation_license", None),
            owner_first_name=getattr(entry, "owner_first_name", None),
            owner_last_name=getattr(entry, "owner_last_name", None),
            owner_email=getattr(entry, "owner_email", None),
            regatta_id=entry.regatta_id,
            user_id=user.id,
            paid=bool(getattr(entry, "paid", False)),
            crew_members=entry.crew_members if getattr(entry, "crew_members", None) else None,
            created_at=datetime.utcnow(),
            waiting_list=is_waiting,
        )
        db.add(new_entry); db.commit(); db.refresh(new_entry)

        sailor_name = f"{(entry.first_name or '').strip()} {(entry.last_name or '').strip()}".strip() or (entry.email or "sailor")
        helm_name = sailor_name
        regatta_name = regatta.name if regatta else "Regatta"
        temp_pwd = getattr(user, "_plaintext_password", None)
        to_email = (entry.email or "").strip() or user.email

        org_id = regatta.organization_id if regatta else 1
        if _entry_email_enabled(db, org_id):
            _send_combined_entry_email(
                background,
                db,
                organization_id=org_id,
                to_email=to_email,
                sailor_name=sailor_name,
                regatta_name=regatta_name,
                class_name=entry.class_name or "",
                boat_name=entry.boat_name or "",
                sail_number=entry.sail_number or "",
                helm_name=helm_name,
                username=getattr(user, "username", None),
                temp_password=temp_pwd,
            )
        return {
            "message": "Inscrição criada com sucesso",
            "id": new_entry.id,
            "user_id": user.id,
            "waiting_list": is_waiting,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("\n[ERROR] create_entry falhou:", e); print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao criar a inscrição. Ver logs do servidor.")

@router.get("/by_regatta/{regatta_id}", response_model=List[schemas.EntryListRead])
def get_entries_by_regatta(
    regatta_id: int,
    class_name: Optional[str] = Query(None, alias="class"),
    include_waiting: bool = Query(False, description="Se true, inclui entries da waiting list."),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    current_regatta_id: Optional[int] = Depends(_get_current_regatta_id_optional),
):
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regatta not found")

    if current_user is not None:
        if current_user.role in ("admin", "platform_admin"):
            assert_user_can_manage_org_id(current_user, reg.organization_id)
        elif current_user.role == "jury":
            assert_jury_regatta_access(db, current_user, regatta_id)
        elif current_user.role == "scorer":
            if int(reg.organization_id) != int(current_user.organization_id):
                raise HTTPException(
                    status_code=403,
                    detail="Sem permissão nesta regata (organização).",
                )
            staff_profile = (
                db.query(models.RegattaJuryProfile)
                .filter(models.RegattaJuryProfile.user_id == current_user.id)
                .first()
            )
            if not staff_profile or int(staff_profile.regatta_id) != int(regatta_id):
                raise HTTPException(status_code=403, detail="Fora do âmbito da tua regata")
        elif current_user.role == "regatista":
            if int(reg.organization_id) != int(current_user.organization_id):
                raise HTTPException(
                    status_code=403,
                    detail="Sem permissão nesta regata (organização).",
                )
            if current_regatta_id is None or int(regatta_id) != int(current_regatta_id):
                raise HTTPException(status_code=403, detail="Fora do âmbito da tua regata")
        else:
            raise HTTPException(status_code=403, detail="Acesso negado")

    q = db.query(models.Entry).filter(models.Entry.regatta_id == regatta_id)
    if class_name:
        q = q.filter(models.Entry.class_name == class_name)
    if not include_waiting:
        q = q.filter(models.Entry.waiting_list == False)  # noqa: E712
    return q.order_by(*_entry_list_order()).all()

@router.get("/{entry_id}", response_model=schemas.EntryRead)
def get_entry_by_id(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    _assert_scorer_can_manage_entry(db, current_user, entry)

    db.delete(entry)
    db.commit()
    return {"message": "Entry deleted permanently.", "id": entry_id}

# ============ PATCH /entries/{entry_id} (admin) ============
def _norm_str(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    t = s.strip()
    return t if t != "" else None

def _norm_sail(s: Optional[str]) -> Optional[str]:
    s = _norm_str(s)
    return s.upper() if s else None

def _class_exists_in_regatta(db: Session, regatta_id: int, class_name: str) -> bool:
    # Preferir tabela RegattaClass se existir
    try:
        exists_row = (
            db.query(models.RegattaClass)
              .filter(
                  models.RegattaClass.regatta_id == regatta_id,
                  func.lower(func.trim(models.RegattaClass.class_name)) == func.lower(func.trim(class_name)),
              )
              .first()
        )
        if exists_row:
            return True
    except Exception:
        pass
    # Fallback: qualquer entry com essa classe nesta regata
    row = (
        db.query(models.Entry.id)
          .filter(
              models.Entry.regatta_id == regatta_id,
              func.lower(func.trim(models.Entry.class_name)) == func.lower(func.trim(class_name)),
          )
          .first()
    )
    return bool(row)

@router.patch("/{entry_id}", response_model=schemas.EntryRead)
def patch_entry(
    entry_id: int,
    body: schemas.EntryPatch = Body(...),
    propagate_keys: bool = Query(False, description="Propagate class/sail changes to Results and Rule42"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # ---- auth ----
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    _assert_scorer_can_manage_entry(db, current_user, entry)

    # valores antigos (para propagação)
    old_class = entry.class_name
    old_sail  = entry.sail_number

    # ---- normalizar inputs ----
    data = body.model_dump(exclude_unset=True)

    if "class_name" in data:
        data["class_name"] = _norm_str(data["class_name"])
    if "sail_number" in data:
        data["sail_number"] = _norm_sail(data["sail_number"])

    # ---- validações ----
    new_class = data.get("class_name", entry.class_name)
    new_sail  = data.get("sail_number", entry.sail_number)
    new_country = data.get("boat_country_code", entry.boat_country_code)

    if new_class:
        if not _class_exists_in_regatta(db, entry.regatta_id, new_class):
            raise HTTPException(status_code=400, detail=f"Class '{new_class}' not allowed for this regatta")

    # Duplicado = mesmo sail number + mesmo country code na mesma classe (POR 1 + POR 1 não; POR 1 + GBR 1 sim)
    if new_sail:
        if _entry_duplicate_sail(
            db,
            entry.regatta_id,
            new_class or entry.class_name,
            new_country if new_country is not None else entry.boat_country_code,
            new_sail,
            exclude_entry_id=entry.id,
        ):
            raise HTTPException(
                status_code=409,
                detail="Já existe uma inscrição com o mesmo número de vela e país (country code) nesta classe. Números iguais só são permitidos com países diferentes (ex.: POR 1, GBR 1).",
            )

    # Confirmar só é permitido se não houver duplicado (número + country code únicos na classe)
    if data.get("confirmed") is True:
        cls = new_class or entry.class_name
        sail = new_sail or entry.sail_number
        country = new_country if "boat_country_code" in data else entry.boat_country_code
        if sail and _entry_duplicate_sail(db, entry.regatta_id, cls, country, sail, exclude_entry_id=entry.id):
            raise HTTPException(
                status_code=400,
                detail="Não pode confirmar: existe outra inscrição com o mesmo número de vela e país nesta classe. Corrija os números de vela (ou países) antes de confirmar.",
            )

    regatta = db.query(models.Regatta).filter(models.Regatta.id == entry.regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")

    if "waiting_list" in data:
        new_wl = data["waiting_list"]
        eff_class = (data.get("class_name", entry.class_name) or entry.class_name or "").strip()
        if new_wl is False and bool(getattr(entry, "waiting_list", False)):
            scope, lim = _online_entry_limit_context(regatta, eff_class)
            if scope is not None and lim is not None:
                cnt = _count_active_entries_for_limit(db, entry.regatta_id, scope, eff_class)
                if cnt >= lim:
                    raise HTTPException(
                        status_code=400,
                        detail="Entry list is full (entry limit reached); cannot move this entry off the waiting list.",
                    )

    # ---- aplicar alterações na Entry ----
    for k, v in data.items():
        setattr(entry, k, v)

    # ---- propagação (opcional) ----
    did_change_class = (new_class is not None and new_class != old_class)
    did_change_sail  = (new_sail  is not None and new_sail  != old_sail)

    if propagate_keys and (did_change_class or did_change_sail):
        # RESULTS
        q_res = db.query(models.Result).filter(models.Result.regatta_id == entry.regatta_id)
        if old_class:
            q_res = q_res.filter(models.Result.class_name == old_class)
        if old_sail:
            q_res = q_res.filter(models.Result.sail_number == old_sail)
        updates_res = {}
        if did_change_class and new_class:
            updates_res[models.Result.class_name] = new_class
        if did_change_sail and new_sail:
            updates_res[models.Result.sail_number] = new_sail
        if updates_res:
            q_res.update(updates_res, synchronize_session=False)

        # RULE42
        try:
            q_r42 = db.query(models.Rule42Record).filter(models.Rule42Record.regatta_id == entry.regatta_id)
            if old_class:
                q_r42 = q_r42.filter(models.Rule42Record.class_name == old_class)
            if old_sail:
                q_r42 = q_r42.filter(models.Rule42Record.sail_num == old_sail)
            updates_r42 = {}
            if did_change_class and new_class:
                updates_r42[models.Rule42Record.class_name] = new_class
            if did_change_sail and new_sail:
                updates_r42[models.Rule42Record.sail_num] = new_sail
            if updates_r42:
                q_r42.update(updates_r42, synchronize_session=False)
        except Exception:
            # se a tabela não existir no projeto, ignorar silenciosamente
            pass

    db.commit()
    db.refresh(entry)
    return entry

@router.patch("/{entry_id}/toggle_paid")
def toggle_paid(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    _assert_scorer_can_manage_entry(db, current_user, entry)
    entry.paid = not entry.paid
    db.commit()
    return {"id": entry.id, "paid": entry.paid}


def _send_confirmed_entry_email(
    background: BackgroundTasks,
    db: Session,
    entry: models.Entry,
    username: str,
    temp_password: str,
) -> None:
    """Queue sending of the confirmed entry email (paid+confirmed) with account credentials."""
    regatta = db.query(models.Regatta).filter(models.Regatta.id == entry.regatta_id).first()
    regatta_name = regatta.name if regatta else "Regatta"
    org_id = regatta.organization_id if regatta else 1
    sailor_name = f"{(getattr(entry, "first_name") or "").strip()} {(getattr(entry, "last_name") or "").strip()}".strip() or (entry.email or "sailor")
    to_email = (entry.email or "").strip()
    if not to_email and entry.user_id:
        u = db.query(models.User).filter(models.User.id == entry.user_id).first()
        to_email = (u.email or "").strip() if u else ""
    if not to_email:
        return
    subject, text = _build_confirmed_entry_email(
        db,
        organization_id=org_id,
        sailor_name=sailor_name,
        event_name=regatta_name,
        class_name=entry.class_name or "",
        boat_name=entry.boat_name or "",
        sail_number=entry.sail_number or "",
        helm_name=sailor_name,
        username=username,
        temp_password=temp_password,
    )
    club = _get_global_setting(db, "club_name", org_id) or CLUB_NAME
    reply_to = _get_global_setting(db, "contact_email", org_id) or REPLY_TO or None
    background.add_task(
        send_email,
        to_email,
        subject,
        None,
        text,
        from_name=club,
        reply_to=reply_to,
    )


@router.post("/{entry_id}/send-confirmation-email")
def send_confirmation_email(
    entry_id: int,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Send the "Confirmed entry" email for this entry. Entry must be paid and confirmed.
    Generates credentials (or a new password for this championship) and sends the email.
    Credentials can change from championship to championship.
    """
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    _assert_scorer_can_manage_entry(db, current_user, entry)
    if not entry.paid or not entry.confirmed:
        raise HTTPException(
            status_code=400,
            detail="Entry must be paid and confirmed before sending the confirmation email.",
        )
    regatta = db.query(models.Regatta).filter(models.Regatta.id == entry.regatta_id).first()
    org_id = regatta.organization_id if regatta else 1
    if not _confirmed_entry_email_enabled(db, org_id):
        raise HTTPException(status_code=400, detail="Confirmed entry email is disabled in Email settings.")
    user = _get_or_create_user_for_entry(db, entry)
    # Generate new temporary password (per championship: overwrites any previous)
    pwd = _gen_temp_password(6)
    user.hashed_password = hash_password(pwd)
    user.email_verified_at = datetime.utcnow()
    db.commit()
    _send_confirmed_entry_email(background, db, entry, user.username, pwd)
    return {"message": "Confirmation email sent.", "entry_id": entry.id}
