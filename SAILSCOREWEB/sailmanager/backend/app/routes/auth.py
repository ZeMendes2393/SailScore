from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import secrets

from app import models
from utils.auth_utils import (
    verify_password,
    create_access_token,
    get_current_user,
    get_db,
    hash_password,
    verify_role
)

router = APIRouter()

# ---- LOGIN ----
@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password or ""):
        raise HTTPException(status_code=400, detail="Credenciais inválidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Conta inativa.")
    token = create_access_token(user.email, user.role)
    return {"access_token": token, "token_type": "bearer", "role": user.role}

# ---- (OPCIONAL) DESATIVAR REGISTO PÚBLICO ----
# Mantém só para admins, se quiseres:
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str

@router.post("/register", dependencies=[Depends(verify_role(["admin"]))])
def register_user(data: RegisterInput, db: Session = Depends(get_db)):
    user_exists = db.query(models.User).filter(models.User.email == data.email).first()
    if user_exists:
        raise HTTPException(status_code=400, detail="Email já registado")
    new_user = models.User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_active=True,
        email_verified_at=datetime.utcnow()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Utilizador criado", "user_id": new_user.id}

# ---- INVITATIONS (ADMIN ONLY) ----
from app.schemas import InvitationCreate, InvitationRead, AcceptInviteInput

def _send_invite_email_log(email: str, link: str):
    # MVP sem email: loga no servidor. Depois trocamos por SMTP/SendGrid.
    print(f"[INVITE] Enviar para {email}: {link}")

@router.post("/invitations", response_model=InvitationRead, dependencies=[Depends(verify_role(["admin"]))])
def create_invitation(data: InvitationCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    token = secrets.token_urlsafe(32)
    inv = models.Invitation(
        email=str(data.email),
        role=data.role,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    link = f"http://localhost:3000/accept-invite?token={token}"  # frontend vai abrir esta rota
    background.add_task(_send_invite_email_log, inv.email, link)
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
        # Atualiza role se for preciso
        user.role = inv.role
        if payload.password:
            user.hashed_password = hash_password(payload.password)
        user.is_active = True
        if not user.email_verified_at:
            user.email_verified_at = datetime.utcnow()
    else:
        user = models.User(
            name=None,
            email=inv.email,
            hashed_password=hash_password(payload.password) if payload.password else None,
            role=inv.role,
            is_active=True,
            email_verified_at=datetime.utcnow()
        )
        db.add(user)

    inv.accepted_at = datetime.utcnow()
    db.commit()

    return {"message": "Convite aceite. Já podes iniciar sessão."}

# ---- PROFILE & AREAS ----
@router.get("/me")
def get_profile(user: models.User = Depends(get_current_user)):
    return {"email": user.email, "role": user.role, "email_verified_at": user.email_verified_at}

@router.get("/admin-area")
def admin_only(user: models.User = Depends(verify_role(["admin"]))):
    return {"message": f"Olá {user.email}, bem-vindo à zona de admin."}

@router.get("/regatista-area")
def regatista_only(user: models.User = Depends(verify_role(["regatista"]))):
    return {"message": f"Olá {user.email}, bem-vindo à zona de regatista."}
