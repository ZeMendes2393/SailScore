# app/routes/entries.py
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from traceback import print_exc
import os, secrets

from app.database import SessionLocal
from app import models, schemas
from utils.auth_utils import get_current_user, hash_password
from app.services.email import send_email  # já aceita from_name/from_email/reply_to

router = APIRouter()

PROVISION_MODE = os.getenv("ACCOUNT_PROVISIONING_MODE", "invite").lower()  # "temp_password" | "invite"
FRONTEND_BASE = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")

DEFAULT_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL") or "no-reply@sailscore.local"
DEFAULT_FROM_NAME  = os.getenv("SMTP_FROM_NAME")  or os.getenv("DEFAULT_CLUB_NAME") or "SailScore"
DEFAULT_REPLY_TO   = os.getenv("DEFAULT_CLUB_REPLY_TO") or None

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------- helpers ----------------

def _gen_temp_password(n: int = 10) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(n))

def _send_invite_email(background: BackgroundTasks, to_email: str, token: str, expires_at: datetime):
    link = f"{FRONTEND_BASE}/accept-invite?token={token}"
    subject = "Ativa a tua Sailor Account"
    text = (
        "Olá!\n\nRecebemos a tua inscrição. Para ativar a tua Sailor Account "
        f"e definir a password, usa este link:\n{link}\n\n"
        f"Este link expira a {expires_at.isoformat()}Z.\n\n— SailScore"
    )
    html = f"""
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;color:#111">
        <p>Olá!</p>
        <p>Recebemos a tua inscrição. Para <b>ativar a tua Sailor Account</b> e definires a password, clica:</p>
        <p><a href="{link}" style="display:inline-block;padding:10px 14px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px">Ativar conta</a></p>
        <p>Ou copia este link:<br><span style="word-break:break-all">{link}</span></p>
        <p style="color:#555;font-size:14px">Este link expira a {expires_at.isoformat()}Z.</p>
      </div>
    """
    print(f"[EMAIL DEBUG] invite -> {to_email}")  # visível no terminal
    background.add_task(
        send_email,
        to_email,
        subject,
        html,
        text,
        from_email=DEFAULT_FROM_EMAIL,
        from_name=DEFAULT_FROM_NAME,
        reply_to=DEFAULT_REPLY_TO,
    )

def _send_temp_password_email(background: BackgroundTasks, to_email: str, email: str, plaintext_password: str):
    login_url = f"{FRONTEND_BASE}/login"
    subject = "Sailor Account — credenciais de acesso"
    text = (
        "Olá!\n\nA tua inscrição foi guardada e criámos a tua Sailor Account.\n\n"
        f"Email: {email}\nPassword temporária: {plaintext_password}\n\n"
        f"Podes iniciar sessão em: {login_url}\n"
        "Por segurança, altera a password após o primeiro login.\n\n— SailScore"
    )
    html = f"""
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;color:#111">
        <p>Olá!</p>
        <p>A tua inscrição foi guardada e criámos a tua <b>Sailor Account</b>.</p>
        <ul>
          <li><b>Email:</b> {email}</li>
          <li><b>Password temporária:</b> <code>{plaintext_password}</code></li>
        </ul>
        <p><a href="{login_url}" style="display:inline-block;padding:10px 14px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px">Iniciar sessão</a></p>
        <p style="color:#555;font-size:14px">Por segurança, altera a password após o primeiro login.</p>
      </div>
    """
    print(f"[EMAIL DEBUG] temp_password -> {to_email}")  # visível no terminal
    background.add_task(
        send_email,
        to_email,
        subject,
        html,
        text,
        from_email=DEFAULT_FROM_EMAIL,
        from_name=DEFAULT_FROM_NAME,
        reply_to=DEFAULT_REPLY_TO,
    )

def _send_entry_confirmation_email(background: BackgroundTasks, to_email: str, regatta_name: str, cls: str, sail: str | None):
    subject = "Inscrição recebida — SailScore"
    text = (
        f"Obrigado! Recebemos a tua inscrição para '{regatta_name}'.\n"
        f"Classe: {cls}\nNúmero de vela: {sail or '-'}\n\n"
        "Se precisares de alterar algo, responde a este email.\n— Organização"
    )
    html = f"""
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;color:#111">
        <p>Obrigado! Recebemos a tua inscrição para <b>{regatta_name}</b>.</p>
        <ul>
          <li><b>Classe:</b> {cls}</li>
          <li><b>Nº de vela:</b> {sail or '-'}</li>
        </ul>
        <p>Se precisares de alterar algo, responde a este email.</p>
      </div>
    """
    print(f"[EMAIL DEBUG] entry_confirmation -> {to_email}")  # visível no terminal
    background.add_task(
        send_email,
        to_email,
        subject,
        html,
        text,
        from_email=DEFAULT_FROM_EMAIL,
        from_name=DEFAULT_FROM_NAME,
        reply_to=DEFAULT_REPLY_TO,
    )

def _ensure_sailor_user_and_profile(db: Session, entry: schemas.EntryCreate):
    """
    Garante utilizador (regatista) e SailorProfile. Devolve (user, created_bool).
    Se PROVISION_MODE for temp_password e o user for novo, coloca _plaintext_password
    para o email com credenciais.
    """
    email = (entry.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email do timoneiro é obrigatório.")

    user = db.query(models.User).filter(models.User.email == email).first()
    created = False

    if not user:
        created = True
        full_name = f"{(entry.first_name or '').strip()} {(entry.last_name or '').strip()}".strip() or None
        user = models.User(
            name=full_name,
            email=email,
            role="regatista",
            is_active=True,
            email_verified_at=None,
        )
        if PROVISION_MODE == "temp_password":
            pwd = _gen_temp_password()
            user.hashed_password = hash_password(pwd)
            user.email_verified_at = datetime.utcnow()  # se quiseres só verificar depois, remove esta linha
            user._plaintext_password = pwd  # transitório
        else:
            user.hashed_password = None
        db.add(user)
        db.flush()

    # upsert SailorProfile
    if hasattr(models, "SailorProfile"):
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

    return user, created

def _create_or_reuse_invitation(background: BackgroundTasks, db: Session, user: models.User):
    if user.email_verified_at:
        return
    existing = db.query(models.Invitation).filter(
        and_(
            models.Invitation.email == user.email,
            models.Invitation.accepted_at.is_(None),
            models.Invitation.expires_at > datetime.utcnow(),
        )
    ).order_by(models.Invitation.id.desc()).first()
    if existing:
        token = existing.token
        expires_at = existing.expires_at
    else:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=7)
        inv = models.Invitation(
            email=user.email,
            role="regatista",
            token=token,
            expires_at=expires_at,
        )
        db.add(inv)
        db.flush()
    _send_invite_email(background, user.email, token, expires_at)

# ---------------- endpoints ----------------

@router.post("/")
def create_entry(entry: schemas.EntryCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        # 1) Utilizador & perfil
        user, created = _ensure_sailor_user_and_profile(db, entry)

        # 2) Entry (snapshot)
        new_entry = models.Entry(
            class_name=entry.class_name,
            boat_country=entry.boat_country,
            sail_number=entry.sail_number,
            boat_name=entry.boat_name,
            category=entry.category,
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
            regatta_id=entry.regatta_id,
            user_id=user.id,
            paid=bool(entry.paid),
        )
        db.add(new_entry)

        # 3) Email conforme o modo
        if PROVISION_MODE == "temp_password":
            if created and hasattr(user, "_plaintext_password"):
                _send_temp_password_email(background, user.email, user.email, user._plaintext_password)
        else:
            _create_or_reuse_invitation(background, db, user)

        # 4) Commit
        db.commit()
        db.refresh(new_entry)

        # 5) Enviar SEMPRE confirmação de inscrição (cortesia)
        try:
            reg = db.query(models.Regatta).filter(models.Regatta.id == entry.regatta_id).first()
            _send_entry_confirmation_email(
                background,
                new_entry.email,
                reg.name if reg else f"Regata #{entry.regatta_id}",
                new_entry.class_name,
                new_entry.sail_number,
            )
        except Exception:
            # nunca falhar a API por causa do email de cortesia
            pass

        return {"message": "Inscrição criada com sucesso", "id": new_entry.id, "user_id": user.id}

    except Exception as e:
        db.rollback()
        print("\n[ERROR] create_entry falhou:", e)
        print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao criar a inscrição. Ver logs do servidor.")

@router.get("/by_regatta/{regatta_id}")
def get_entries_by_regatta(
    regatta_id: int,
    class_name: str | None = Query(None, alias="class"),
    db: Session = Depends(get_db)
):
    q = db.query(models.Entry).filter(models.Entry.regatta_id == regatta_id)
    if class_name:
        q = q.filter(models.Entry.class_name == class_name)
    return q.all()

@router.get("/{entry_id}", response_model=schemas.EntryRead)
def get_entry_by_id(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry

@router.patch("/{entry_id}/toggle_paid")
def toggle_paid(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    entry.paid = not entry.paid
    db.commit()
    return {"id": entry.id, "paid": entry.paid}
