# app/routes/regattas.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime, timedelta, timezone
import os

from app import models, schemas
from app.metadata.timezones import is_valid_iana_timezone, is_valid_timezone_for_country
from app.database import get_db
from app.org_scope import assert_staff_regatta_access, assert_user_can_manage_org_id, resolve_org
from utils.auth_utils import (
    get_current_user,
    get_current_user_optional,
    get_current_regatta_id_optional,
)
from app.jury_scope import assert_jury_regatta_access


def _validate_regatta_timezone_country(country_code: str | None, timezone_str: str) -> None:
    """Validate that timezone is IANA-valid and belongs to the country. Raises HTTPException on failure."""
    if not timezone_str:
        return
    if not is_valid_iana_timezone(timezone_str):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid IANA timezone: {timezone_str}. Use identifiers like Europe/Lisbon, Atlantic/Azores.",
        )
    if country_code and not is_valid_timezone_for_country(timezone_str, str(country_code)):
        raise HTTPException(
            status_code=400,
            detail=f"Timezone {timezone_str} is not valid for country {country_code}.",
        )


router = APIRouter(prefix="/regattas", tags=["regattas"])

# ---------------- Regattas CRUD ----------------

@router.get("/", response_model=List[schemas.RegattaListRead])
def list_regattas(
    organization_id: Optional[int] = Query(None, description="ID da organização"),
    org: Optional[str] = Query(None, description="Slug da organização (alternativa a organization_id)"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    q = db.query(models.Regatta).options(joinedload(models.Regatta.classes))
    # Org admin: sempre filtrar pela sua organização (não pode ver outras)
    if current_user and current_user.role == "admin" and current_user.organization_id:
        q = q.filter(models.Regatta.organization_id == current_user.organization_id)
    elif organization_id is not None:
        q = q.filter(models.Regatta.organization_id == organization_id)
    elif org:
        organization = resolve_org(db, org_slug=org)
        q = q.filter(models.Regatta.organization_id == organization.id)
    else:
        # Sem ?org nem organization_id: não listar todas as orgs misturadas (multi-tenant).
        # Usa a organização default (slug sailscore) — igual a /design/homepage sem org.
        # platform_admin pode pedir a lista global sem filtro (ferramentas internas).
        if not (current_user and current_user.role == "platform_admin"):
            default_org = resolve_org(db, org_slug=None)
            q = q.filter(models.Regatta.organization_id == default_org.id)
    regattas = q.order_by(models.Regatta.start_date).all()
    # RegattaListRead exige str; colunas na BD podem ser NULL → sem coerção dava ValidationError (500).
    return [
        schemas.RegattaListRead(
            id=r.id,
            organization_id=r.organization_id,
            organization_slug=r.organization.slug if r.organization else None,
            name=r.name or "",
            location=r.location or "",
            start_date=r.start_date or "",
            end_date=r.end_date or "",
            online_entry_open=r.online_entry_open if r.online_entry_open is not None else True,
            class_names=[
                (c.class_name or "")
                for c in sorted(r.classes or [], key=lambda c: (c.class_name or ""))
            ],
            listing_logo_url=getattr(r, "listing_logo_url", None),
        )
        for r in regattas
    ]

def _get_default_org_id(db: Session) -> int:
    org = db.query(models.Organization).filter(models.Organization.slug == "sailscore").first()
    if not org:
        raise HTTPException(status_code=500, detail="Organização default (sailscore) não encontrada")
    return org.id


@router.post("/", response_model=schemas.RegattaRead)
def create_regatta(
    regatta: schemas.RegattaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    if current_user.role == "admin":
        org_id = current_user.organization_id
    else:
        org_id = regatta.organization_id if regatta.organization_id is not None else _get_default_org_id(db)
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=400, detail="Organização não encontrada")
    if not org.is_active:
        raise HTTPException(status_code=400, detail="Organização inativa")
    assert_user_can_manage_org_id(current_user, org_id)
    data = regatta.model_dump(exclude={"organization_id"})
    data["organization_id"] = org_id
    cc = data.get("country_code")
    tz = data.get("timezone")
    if tz:
        _validate_regatta_timezone_country(cc, tz)
    new_regatta = models.Regatta(**data)
    db.add(new_regatta)
    db.commit()
    db.refresh(new_regatta)
    return new_regatta

@router.get("/{regatta_id}", response_model=schemas.RegattaRead)
def get_regatta(
    regatta_id: int,
    db: Session = Depends(get_db),
):
    r = (
        db.query(models.Regatta)
        .options(joinedload(models.Regatta.organization))
        .filter(models.Regatta.id == regatta_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Regatta not found")
    slug = r.organization.slug if r.organization else None
    data = schemas.RegattaRead.model_validate(r, from_attributes=True)
    return data.model_copy(update={"organization_slug": slug})

@router.patch("/{regatta_id}", response_model=schemas.RegattaRead)
def update_regatta(
    regatta_id: int,
    body: schemas.RegattaUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regata não encontrada")
    if current_user.role in ("admin", "platform_admin"):
        assert_user_can_manage_org_id(current_user, reg.organization_id)
    else:
        assert_staff_regatta_access(db, current_user, regatta_id)

    data = body.model_dump(exclude_unset=True)
    if current_user.role == "scorer":
        scorer_allowed_fields = {
            "online_entry_open",
            "online_entry_limit_enabled",
            "online_entry_limit",
            "online_entry_limits_by_class",
            "entry_list_columns",
            "results_overall_columns",
        }
        data = {k: v for k, v in data.items() if k in scorer_allowed_fields}
        if not data:
            raise HTTPException(status_code=403, detail="Acesso negado")
    if "organization_id" in data:
        org = db.query(models.Organization).filter(models.Organization.id == data["organization_id"]).first()
        if not org:
            raise HTTPException(status_code=400, detail="Organização não encontrada")
        if not org.is_active:
            raise HTTPException(status_code=400, detail="Organização inativa")
    cc_new = data.get("country_code")
    tz_new = data.get("timezone")
    cc = str(cc_new) if cc_new is not None else getattr(reg, "country_code", None)
    tz = str(tz_new) if tz_new is not None else getattr(reg, "timezone", None)

    if tz:
        _validate_regatta_timezone_country(cc, tz)
    if "country_code" in data and cc and tz and not is_valid_timezone_for_country(tz, str(cc)):
        data["timezone"] = None

    for field, value in data.items():
        setattr(reg, field, value)

    db.commit()
    db.refresh(reg)
    return reg

@router.delete("/{regatta_id}", status_code=204)
def delete_regatta(
    regatta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regata não encontrada")
    assert_user_can_manage_org_id(current_user, reg.organization_id)

    db.delete(reg)
    db.commit()
    return

# ---------------- Scoring patch ----------------

class ScoringPatch(BaseModel):
    discard_count: int = Field(ge=0)
    discard_threshold: int = Field(ge=0)
    code_points: Optional[Dict[str, float]] = None  # pontos por código (DNF/DNC...)

@router.patch("/{regatta_id}/scoring", response_model=schemas.RegattaRead)
def update_scoring(
    regatta_id: int,
    body: ScoringPatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regata não encontrada")
    assert_user_can_manage_org_id(current_user, regatta.organization_id)

    regatta.discard_count = body.discard_count
    regatta.discard_threshold = body.discard_threshold

    if body.code_points is not None:
        regatta.scoring_codes = {k.upper(): float(v) for k, v in body.code_points.items()}

    db.commit()
    db.refresh(regatta)
    return regatta

# ---------- MODELOS DE RESPOSTA ----------

class RegattaWindows(BaseModel):
    entryData: bool
    documents: bool
    rule42: bool
    scoreReview: bool
    requests: bool
    protest: bool

class RegattaMeta(BaseModel):
    id: int
    name: str

class RegattaStatusResponse(BaseModel):
    status: Literal["upcoming", "active", "finished"]
    now_utc: datetime
    start_utc: Optional[datetime] = None
    end_utc: Optional[datetime] = None
    windows: RegattaWindows
    regatta: Optional[RegattaMeta] = None

# ---------- HELPERS ----------

def _parse_date_utc(d: Optional[str]) -> Optional[datetime]:
    if not d:
        return None
    try:
        dt = datetime.strptime(d, "%Y-%m-%d")
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None

def _env_bool(key: str, default: bool = False) -> bool:
    val = os.getenv(key, "")
    if not val:
        return default
    return val.strip().lower() in ("1", "true", "yes", "y", "on")

def _env_csv_set(key: str) -> set[str]:
    raw = os.getenv(key, "")
    if not raw:
        return set()
    return {p.strip() for p in raw.split(",") if p.strip()}

def _compute_regatta_status(reg: models.Regatta) -> RegattaStatusResponse:
    now = datetime.now(timezone.utc)
    start = _parse_date_utc(reg.start_date)
    end = _parse_date_utc(reg.end_date)

    if not start or not end:
        status = "upcoming"
    else:
        end_inclusive = end + timedelta(days=1) - timedelta(seconds=1)
        if now < start:
            status = "upcoming"
        elif start <= now <= end_inclusive:
            status = "active"
        else:
            status = "finished"

    GRACE_SCORE_REVIEW_HOURS = 12
    GRACE_PROTEST_HOURS = 6

    is_active = (status == "active")

    can_rule42       = is_active
    can_requests     = is_active
    can_score_review = is_active or (end is not None and now <= end + timedelta(hours=GRACE_SCORE_REVIEW_HOURS))
    can_protest      = is_active or (end is not None and now <= end + timedelta(hours=GRACE_PROTEST_HOURS))
    can_entry_data   = True
    can_documents    = True

    if _env_bool("WINDOWS_FORCE_OPEN", False):
        can_entry_data = can_documents = can_rule42 = can_score_review = can_requests = can_protest = True
    else:
        force_set = _env_csv_set("WINDOWS_FORCE_ENABLE")
        if "entryData"   in force_set: can_entry_data = True
        if "documents"   in force_set: can_documents = True
        if "rule42"      in force_set: can_rule42 = True
        if "scoreReview" in force_set: can_score_review = True
        if "requests"    in force_set: can_requests = True
        if "protest"     in force_set: can_protest = True

    return RegattaStatusResponse(
        status=status,
        now_utc=now,
        start_utc=start,
        end_utc=end,
        windows=RegattaWindows(
            entryData=bool(can_entry_data),
            documents=bool(can_documents),
            rule42=bool(can_rule42),
            scoreReview=bool(can_score_review),
            requests=bool(can_requests),
            protest=bool(can_protest),
        ),
        regatta=RegattaMeta(id=reg.id, name=reg.name) if reg else None,
    )

# ---------- ENDPOINT ----------

@router.get("/{regatta_id}/status", response_model=RegattaStatusResponse)
def get_regatta_status(
    regatta_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    current_regatta_id: Optional[int] = Depends(get_current_regatta_id_optional),
):
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regata não encontrada")

    if current_user is not None:
        if current_user.role in ("admin", "platform_admin"):
            assert_user_can_manage_org_id(current_user, reg.organization_id)
        elif current_user.role == "jury":
            assert_jury_regatta_access(db, current_user, regatta_id)
        elif current_user.role == "regatista":
            if int(reg.organization_id) != int(current_user.organization_id):
                raise HTTPException(
                    status_code=403,
                    detail="Sem permissão nesta regata (organização).",
                )
            if current_regatta_id is None or int(regatta_id) != int(current_regatta_id):
                raise HTTPException(status_code=403, detail="Fora do âmbito da tua regata")
        elif current_user.role == "scorer":
            assert_staff_regatta_access(db, current_user, regatta_id)
        else:
            raise HTTPException(status_code=403, detail="Acesso negado")

    return _compute_regatta_status(reg)

@router.get("/{regatta_id}/classes/detailed", response_model=List[schemas.RegattaClassRead])
def get_classes_detailed(
    regatta_id: int,
    db: Session = Depends(get_db),
):
    """Devolve classes com class_type (one_design | handicap)."""
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regata não encontrada")
    rows = (
        db.query(models.RegattaClass)
        .filter(models.RegattaClass.regatta_id == regatta_id)
        .order_by(models.RegattaClass.class_type, models.RegattaClass.class_name)
        .all()
    )
    if rows:
        return rows
    # Fallback legacy: deduzir a partir das entries (todos one_design)
    entries = (
        db.query(models.Entry.class_name)
        .filter(models.Entry.regatta_id == regatta_id, models.Entry.class_name.isnot(None))
        .distinct()
        .all()
    )
    return [
        schemas.RegattaClassRead(id=0, regatta_id=regatta_id, class_name=e[0], class_type="one_design", sailors_per_boat=1)
        for e in entries if e[0] and (e[0] or "").strip()
    ]


@router.get("/{regatta_id}/classes", response_model=List[str])
def get_classes_for_regatta(
    regatta_id: int,
    db: Session = Depends(get_db),
):
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regata não encontrada")

    # 1) Preferir as classes configuradas (RegattaClass) — funciona para regatas novas
    try:
        rc_rows = (
            db.query(func.min(func.trim(models.RegattaClass.class_name)).label("cls"))
              .filter(models.RegattaClass.regatta_id == regatta_id)
              .filter(models.RegattaClass.class_name.isnot(None))
              .group_by(func.lower(func.trim(models.RegattaClass.class_name)))
              .order_by(func.min(func.trim(models.RegattaClass.class_name)))
              .all()
        )
        rc_classes = [r.cls for r in rc_rows if r and r.cls]
        if rc_classes:
            return rc_classes
    except Exception:
        # se por algum motivo a tabela/model não existir, cai para o fallback
        pass

    # 2) Fallback legacy: deduzir a partir das entries — mantém compatibilidade com regatas antigas
    rows = (
        db.query(func.min(func.trim(models.Entry.class_name)).label("cls"))
          .filter(models.Entry.regatta_id == regatta_id)
          .filter(models.Entry.class_name.isnot(None))
          .group_by(func.lower(func.trim(models.Entry.class_name)))
          .order_by(func.min(func.trim(models.Entry.class_name)))
          .all()
    )
    return [r.cls for r in rows if r and r.cls]

# --------- SUBSTITUIR classes (em lote) ---------
@router.put("/{regatta_id}/classes", response_model=List[schemas.RegattaClassRead])
def replace_regatta_classes(
    regatta_id: int,
    body: schemas.RegattaClassesReplace,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regata não encontrada")
    assert_user_can_manage_org_id(current_user, reg.organization_id)

    # Normalizar: (class_name, class_type, sailors_per_boat)
    normalized: List[tuple[str, str, int]] = []
    seen: set[str] = set()
    for item in body.classes or []:
        s = (item.class_name or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        ctype = (item.class_type or "one_design").strip().lower()
        if ctype not in ("one_design", "handicap"):
            ctype = "one_design"
        sailors = getattr(item, "sailors_per_boat", 1) or 1
        if not isinstance(sailors, int) or sailors < 1:
            sailors = 1
        normalized.append((s, ctype, sailors))

    existing = db.query(models.RegattaClass).filter_by(regatta_id=regatta_id).all()
    existing_by_key = {rc.class_name.strip().lower(): rc for rc in existing}

    target_keys = {c[0].lower() for c in normalized}
    norm_by_key = {c[0].lower(): (c[0], c[1], c[2]) for c in normalized}
    to_delete = [rc for k, rc in existing_by_key.items() if k not in target_keys]
    to_add = [(cname, ctype, sailors) for cname, ctype, sailors in normalized if cname.lower() not in existing_by_key]
    to_update = [
        rc for k, rc in existing_by_key.items()
        if k in norm_by_key and (
            (rc.class_type or "one_design").lower() != norm_by_key[k][1]
            or getattr(rc, "sailors_per_boat", 1) != norm_by_key[k][2]
        )
    ]

    # Não permitir remover uma classe que ainda tenha inscrições ou corridas
    for rc in to_delete:
        cname = (rc.class_name or "").strip()
        if not cname:
            continue
        has_entries = (
            db.query(models.Entry.id)
            .filter_by(regatta_id=regatta_id, class_name=cname)
            .limit(1)
            .first()
        )
        if has_entries:
            raise HTTPException(
                status_code=400,
                detail=f"Não é possível remover a classe '{cname}': ainda existem inscrições. Elimine ou altere as inscrições primeiro.",
            )
        has_races = (
            db.query(models.Race.id)
            .filter_by(regatta_id=regatta_id, class_name=cname)
            .limit(1)
            .first()
        )
        if has_races:
            raise HTTPException(
                status_code=400,
                detail=f"Não é possível remover a classe '{cname}': ainda existem corridas. Elimine ou altere as corridas primeiro.",
            )

    # Ao remover uma classe, apagar também as configurações por classe (RegattaClassSettings)
    for rc in to_delete:
        db.query(models.RegattaClassSettings).filter(
            models.RegattaClassSettings.regatta_id == regatta_id,
            models.RegattaClassSettings.class_name == (rc.class_name or "").strip(),
        ).delete()
        db.delete(rc)
    for rc in to_update:
        _, ctype, sailors = norm_by_key[(rc.class_name or "").strip().lower()]
        rc.class_type = ctype
        rc.sailors_per_boat = sailors
    for cname, ctype, sailors in to_add:
        db.add(
            models.RegattaClass(
                regatta_id=regatta_id,
                class_name=cname,
                class_type=ctype,
                sailors_per_boat=sailors,
            )
        )

    db.commit()

    return (
        db.query(models.RegattaClass)
          .filter_by(regatta_id=regatta_id)
          .order_by(models.RegattaClass.class_name)
          .all()
    )
