# app/routes/auth.py
from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from utils.auth_utils import (
    verify_password,
    create_access_token,
    get_current_user,
    get_current_regatta_id,
    hash_password,
    verify_role,
)

# 👇 ADICIONA O PREFIXO /auth (isto resolve o 404)
router = APIRouter(prefix="/auth", tags=["auth"])

# ---------- LOGIN (JSON) ----------
# Espera schemas.UserLogin: { email: str, password: str, regatta_id?: int }
@router.post("/login", response_model=schemas.Token)
def login(body: schemas.UserLogin, db: Session = Depends(get_db)):
    """
    Login JSON:
    - Admin: body.email = email real
    - Sailor Account: body.email = username (ex.: JoseMendes115)
    """
    raw = (body.email or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Identificador em falta.")

    # Se parecer email, autentica por email; caso contrário, por username.
    if "@" in raw:
        ident_is_email = True
        lookup = db.query(models.User).filter(models.User.email == raw.lower()).first()
    else:
        ident_is_email = False
        lookup = db.query(models.User).filter(models.User.username == raw).first()

    user = lookup
    if not user or not verify_password(body.password, user.hashed_password or ""):
        raise HTTPException(status_code=400, detail="Credenciais inválidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Conta inativa")

    claims: dict = {"sub": user.email, "role": user.role}

    if user.role == "regatista":
        # regatas onde tem inscrição
        my_regatta_rows = (
            db.query(models.Entry.regatta_id)
            .filter(models.Entry.user_id == user.id)
            .distinct()
            .all()
        )
        my_regattas = [int(r[0]) for r in my_regatta_rows]

        if body.regatta_id is not None:
            if int(body.regatta_id) not in my_regattas:
                raise HTTPException(status_code=403, detail="Não tens inscrição nessa regata")
            claims["regatta_id"] = int(body.regatta_id)
        else:
            if len(my_regattas) == 0:
                raise HTTPException(status_code=403, detail="Sem inscrição em nenhuma regata")
            if len(my_regattas) == 1:
                claims["regatta_id"] = my_regattas[0]
            else:
                # força o frontend a escolher
                raise HTTPException(
                    status_code=409,
                    detail={"requires_regatta_selection": True, "regattas": my_regattas},
                )

    token = create_access_token(claims)
    return schemas.Token(access_token=token)

# ---------- LOGIN (FORM) OPCIONAL ----------
# Útil se ainda tiveres um cliente a enviar application/x-www-form-urlencoded
@router.post("/login-form", response_model=schemas.Token)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Versão form-url-encoded:
    - Se username tiver '@' → trata como email (admin)
    - Caso contrário → trata como username (sailor)
    """
    raw = (form.username or "").strip()
    if "@" in raw:
        user = db.query(models.User).filter(models.User.email == raw.lower()).first()
    else:
        user = db.query(models.User).filter(models.User.username == raw).first()

    if not user or not verify_password(form.password, user.hashed_password or ""):
        raise HTTPException(status_code=400, detail="Credenciais inválidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Conta inativa")

    claims: dict = {"sub": user.email, "role": user.role}
    token = create_access_token(claims)
    return schemas.Token(access_token=token)

# ---------- /me ----------
@router.get("/me")
def me(
    current_user: models.User = Depends(get_current_user),
    current_regatta_id: Optional[int] = Depends(get_current_regatta_id),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "current_regatta_id": current_regatta_id,  # admin pode vir None
        "email_verified_at": current_user.email_verified_at,
    }

# ---------- REGISTO (apenas admin) ----------
class RegisterInput(BaseModel):
    name: Optional[str] = None
    email: EmailStr
    password: str
    role: str

@router.post("/register", dependencies=[Depends(verify_role(["admin"]))])
def register_user(data: RegisterInput, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.email == data.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email já registado")

    new_user = models.User(
        name=data.name,
        email=str(data.email).lower().strip(),
        hashed_password=hash_password(data.password),
        role=data.role,
        is_active=True,
        email_verified_at=datetime.utcnow(),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Utilizador criado", "user_id": new_user.id}

# ---------- Convites (admin) ----------
from app.schemas import InvitationCreate, InvitationRead, AcceptInviteInput

def _send_invite_email_log(email: str, link: str):
    print(f"[INVITE] Enviar para {email}: {link}")

@router.post("/invitations", response_model=InvitationRead, dependencies=[Depends(verify_role(["admin"]))])
def create_invitation(data: InvitationCreate, db: Session = Depends(get_db)):
    token = secrets.token_urlsafe(32)
    inv = models.Invitation(
        email=str(data.email).lower().strip(),
        role=data.role,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    link = f"http://localhost:3000/accept-invite?token={token}"
    _send_invite_email_log(inv.email, link)
    return inv

@router.post("/accept-invite")
def accept_invite(payload: AcceptInviteInput, db: Session = Depends(get_db)):
    inv = db.query(models.Invitation).filter(models.Invitation.token == payload.token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Convite inválido")
    if inv.accepted_at:
        raise HTTPException(status_code=400, detail="Convite já aceite")
    if inv.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Convite expirado")

    user = db.query(models.User).filter(models.User.email == inv.email).first()
    if user:
        user.role = inv.role
        if payload.password:
            user.hashed_password = hash_password(payload.password)
        user.is_active = True
        if not user.email_verified_at:
            user.email_verified_at = datetime.utcnow()
    else:
        user = models.User(
            name=None,
            email=inv.email.lower().strip(),
            hashed_password=hash_password(payload.password) if payload.password else None,
            role=inv.role,
            is_active=True,
            email_verified_at=datetime.utcnow(),
        )
        db.add(user)

    inv.accepted_at = datetime.utcnow()
    db.commit()
    return {"message": "Convite aceite. Já podes iniciar sessão."}

# ---------- Áreas por role ----------
@router.get("/admin-area")
def admin_only(user: models.User = Depends(verify_role(["admin"]))):
    return {"message": f"Olá {user.email}, bem-vindo à zona de admin."}

@router.get("/regatista-area")
def regatista_only(user: models.User = Depends(verify_role(["regatista"]))):
    return {"message": f"Olá {user.email}, bem-vindo à zona de regatista."}

# ---------- Trocar regata (novo token com regatta_id) ----------
@router.post("/switch-regatta", response_model=schemas.Token)
def switch_regatta(
    regatta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    claims: dict = {"sub": current_user.email, "role": current_user.role}

    if current_user.role == "admin":
        claims["regatta_id"] = int(regatta_id)
        return schemas.Token(access_token=create_access_token(claims))

    ok = db.query(models.Entry).filter(
        models.Entry.user_id == current_user.id,
        models.Entry.regatta_id == regatta_id,
    ).first()
    if not ok:
        raise HTTPException(status_code=403, detail="Não tens inscrição nessa regata")

    claims["regatta_id"] = int(regatta_id)
    return schemas.Token(access_token=create_access_token(claims))
