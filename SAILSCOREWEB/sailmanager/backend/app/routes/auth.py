from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
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
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Credenciais inválidas")

    token = create_access_token(user.email, user.role)
    return {"access_token": token, "token_type": "bearer", "role": user.role}

# ---- REGISTER ----
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # "admin", "regatista"

@router.post("/register")
def register_user(data: RegisterInput, db: Session = Depends(get_db)):
    user_exists = db.query(models.User).filter(models.User.email == data.email).first()
    if user_exists:
        raise HTTPException(status_code=400, detail="Email já registado")

    new_user = models.User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "Utilizador registado com sucesso", "user_id": new_user.id}

# ---- PROFILE & AREAS ----
@router.get("/me")
def get_profile(user: models.User = Depends(get_current_user)):
    return {"email": user.email, "role": user.role}

@router.get("/admin-area")
def admin_only(user: models.User = Depends(verify_role(["admin"]))):
    return {"message": f"Olá {user.email}, bem-vindo à zona de admin."}

@router.get("/regatista-area")
def regatista_only(user: models.User = Depends(verify_role(["regatista"]))):
    return {"message": f"Olá {user.email}, bem-vindo à zona de regatista."}
