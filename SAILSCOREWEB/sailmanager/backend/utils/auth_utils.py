# utils/auth_utils.py
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, status  # 👈 Header adicionado
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app import models

# ---------------- Password hashing ----------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)

# ---------------- JWT config ----------------
SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def create_access_token(claims: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = claims.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ---------------- DB session ----------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------- Helpers ----------------
def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    """
    Extrai o token Bearer de um header Authorization.
    Se não existir/for inválido, devolve None.
    """
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None

def _decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

# ---------------- Current user (obrigatório) ----------------
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = _decode_token(token)
        email: str | None = payload.get("sub")
        if not email:
            raise credentials_exception
        oid = payload.get("oid")
    except JWTError:
        raise credentials_exception

    q = db.query(models.User).filter(models.User.email == email)
    if oid is not None:
        q = q.filter(models.User.organization_id == int(oid))
    else:
        # tokens antigos (sem oid): compatibilidade — só se existir um utilizador com este email
        pass
    user = q.first()
    if user is None and oid is None:
        user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# ---------------- Current user (opcional / público) ----------------
def get_current_user_optional(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    """
    Versão tolerante: se não houver Authorization ou o token for inválido,
    devolve None (utilizador anónimo). Não lança 401.
    """
    token = _extract_bearer_token(authorization)
    if not token:
        return None
    try:
        payload = _decode_token(token)
        email: Optional[str] = payload.get("sub")
        if not email:
            return None
        oid = payload.get("oid")
        q = db.query(models.User).filter(models.User.email == email)
        if oid is not None:
            q = q.filter(models.User.organization_id == int(oid))
        user = q.first()
        if user is None and oid is None:
            user = db.query(models.User).filter(models.User.email == email).first()
        return user
    except Exception:
        return None

# ---------------- Regatta id (estrito vs opcional) ----------------
def get_current_regatta_id(
    token: str = Depends(oauth2_scheme),
) -> Optional[int]:
    """
    Lê 'regatta_id' do token. Pode ser None (ex.: admin).
    Lança 401 se o token for inválido.
    """
    try:
        payload = _decode_token(token)
        rid = payload.get("regatta_id", None)
        if rid is None:
            return None
        try:
            return int(rid)
        except (ValueError, TypeError):
            return None
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def get_current_regatta_id_optional(
    authorization: Optional[str] = Header(default=None),
) -> Optional[int]:
    """
    Versão TOLERANTE: nunca levanta 401/422 por falta de token.
    Se o token for inválido ou não tiver 'regatta_id', devolve None.
    """
    token = _extract_bearer_token(authorization)
    if not token:
        return None
    try:
        payload = _decode_token(token)
        rid = payload.get("regatta_id", None)
        return int(rid) if rid is not None else None
    except Exception:
        return None

# ---------------- Role guard ----------------
def verify_role(required_roles: list[str]):
    """Aceita 'admin' como sinónimo de admin de organização + platform_admin."""

    def role_checker(user: models.User = Depends(get_current_user)):
        allowed = set(required_roles)
        if "admin" in allowed:
            allowed.add("platform_admin")
        if user.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Permissão negada. Requer um dos roles: {required_roles}"
            )
        return user
    return role_checker
