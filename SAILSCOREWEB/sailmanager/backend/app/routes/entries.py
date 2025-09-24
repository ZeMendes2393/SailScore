# app/routes/entries.py
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import datetime
import secrets, os
from traceback import print_exc
from typing import Optional, List

from app.database import SessionLocal
from app import models, schemas
from utils.auth_utils import get_current_user, hash_password, get_current_regatta_id, get_current_regatta_id_optional as _get_current_regatta_id_optional
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

# ---------------- LIST /entries ----------------
@router.get("", response_model=List[schemas.EntryRead])   # <— sem barra
@router.get("/", response_model=List[schemas.EntryRead])  # <— com barra
def list_entries(
    regatta_id: Optional[int] = Query(None, description="Filtrar por regata."),
    mine: bool = Query(False, description="Se true, devolve apenas as tuas entries."),
    class_name: Optional[str] = Query(None, alias="class", description="Filtra por classe (opcional)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    current_regatta_id: Optional[int] = Depends(_get_current_regatta_id_optional),
):
    q = db.query(models.Entry)

    # Admin
    if current_user.role == "admin":
        if regatta_id is not None:
            q = q.filter(models.Entry.regatta_id == regatta_id)
        if mine:
            q = q.filter(models.Entry.user_id == current_user.id)
        if class_name:
            q = q.filter(models.Entry.class_name == class_name)
        return q.order_by(models.Entry.class_name, models.Entry.sail_number).all()

    # Regatista
    if mine:
        rid = regatta_id or current_regatta_id  # query tem prioridade
        if rid is None:
            return []  # Sem regata ativa → FE mostra aviso
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
        return q.order_by(models.Entry.class_name, models.Entry.sail_number).all()

    # Regatista a pedir geral
    raise HTTPException(status_code=400, detail="Usa /entries/by_regatta/{regatta_id} para listagens gerais.")

# ---------------- helpers ----------------
def _gen_temp_password(n: int = 10) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(n))

def _ensure_sailor_user_and_profile(db: Session, entry: schemas.EntryCreate) -> models.User:
    email = (entry.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email do timoneiro é obrigatório.")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        full_name = f"{(entry.first_name or '').strip()} {(entry.last_name or '').strip()}".strip() or None
        user = models.User(
            name=full_name, email=email, role="regatista",
            is_active=True, email_verified_at=None,
        )
        if PROVISION_MODE == "temp_password":
            pwd = _gen_temp_password()
            user.hashed_password = hash_password(pwd)
            user.email_verified_at = datetime.utcnow()
            user._plaintext_password = pwd
        db.add(user); db.flush()
    else:
        if PROVISION_MODE == "temp_password" and not user.hashed_password:
            pwd = _gen_temp_password()
            user.hashed_password = hash_password(pwd)
            user.email_verified_at = datetime.utcnow()
            user._plaintext_password = pwd

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

def _send_combined_entry_email(
    background: BackgroundTasks, *,
    to_email: str, athlete_name: str, regatta_name: str,
    user_email: str, user_phone: str | None, temp_password: str | None,
):
    user_phone = user_phone or "—"
    login_url = f"{FRONTEND_BASE}/login"
    if temp_password:
        subject = f"Inscrição confirmada + acesso à tua conta — {regatta_name}"
        text = f"""Olá {athlete_name}, ...

Acesso:
• Email: {user_email}
• Palavra-passe temporária: {temp_password}
"""
        html = f"""<div>...</div>"""
    else:
        subject = f"Inscrição confirmada — {regatta_name}"
        text = f"""Olá {athlete_name}, ..."""
        html = f"""<div>...</div>"""
    background.add_task(send_email, to_email, subject, html, text, from_name=CLUB_NAME, reply_to=REPLY_TO)

# ---------------- endpoints ----------------
@router.post("", status_code=status.HTTP_201_CREATED)   # <— sem barra
@router.post("/", status_code=status.HTTP_201_CREATED)  # <— com barra
def create_entry(entry: schemas.EntryCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        user = _ensure_sailor_user_and_profile(db, entry)
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
            paid=bool(getattr(entry, "paid", False)),
        )
        db.add(new_entry); db.commit(); db.refresh(new_entry)

        athlete_name = f"{(entry.first_name or '').strip()} {(entry.last_name or '').strip()}".strip() or entry.email
        regatta = db.query(models.Regatta).filter(models.Regatta.id == entry.regatta_id).first()
        regatta_name = regatta.name if regatta else "Regata"
        temp_pwd = getattr(user, "_plaintext_password", None)

        _send_combined_entry_email(
            background,
            to_email=user.email,
            athlete_name=athlete_name,
            regatta_name=regatta_name,
            user_email=user.email,
            user_phone=entry.contact_phone_1 or "",
            temp_password=temp_pwd,
        )
        # manténs o formato que o teu FE parece esperar
        return {"message": "Inscrição criada com sucesso", "id": new_entry.id, "user_id": user.id}
    except Exception as e:
        db.rollback()
        print("\n[ERROR] create_entry falhou:", e); print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao criar a inscrição. Ver logs do servidor.")

@router.get("/by_regatta/{regatta_id}")
def get_entries_by_regatta(
    regatta_id: int,
    class_name: Optional[str] = Query(None, alias="class"),
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
