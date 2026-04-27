"""Admin: staff profiles per regatta + generate jury/scorer login credentials."""
from __future__ import annotations

import secrets
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.auth_helpers import make_unique_username
from app.database import get_db
from app.org_scope import assert_user_can_manage_org_id
from utils.auth_utils import verify_role, hash_password

router = APIRouter(prefix="/regattas", tags=["regatta-jury"])


def _get_regatta(db: Session, regatta_id: int) -> models.Regatta:
    r = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Regatta not found")
    return r


def _profile_for_regatta(
    db: Session, regatta_id: int, profile_id: int
) -> models.RegattaJuryProfile:
    p = (
        db.query(models.RegattaJuryProfile)
        .filter(
            models.RegattaJuryProfile.id == profile_id,
            models.RegattaJuryProfile.regatta_id == regatta_id,
        )
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Jury profile not found")
    return p


# --- Schemas ---

class JuryProfileCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=200)
    note: Optional[str] = Field(None, max_length=500)
    auto_generate_credentials: bool = True
    credentials_role: Literal["jury", "scorer"] = "jury"


class JuryProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    note: Optional[str] = Field(None, max_length=500)


class JuryProfileRead(BaseModel):
    id: int
    regatta_id: int
    display_name: str
    note: Optional[str] = None
    has_credentials: bool
    username: Optional[str] = None
    credentials_role: Optional[Literal["jury", "scorer"]] = None

    class Config:
        from_attributes = True


class JuryCredentialsOut(BaseModel):
    username: str
    password: str
    role: Literal["jury", "scorer"]
    message: str = "Save these credentials now. The password will not be shown again."


class JuryProfileCreateResult(BaseModel):
    profile: JuryProfileRead
    credentials: Optional[JuryCredentialsOut] = None


def _to_read(db: Session, p: models.RegattaJuryProfile) -> JuryProfileRead:
    username: Optional[str] = None
    credentials_role: Optional[Literal["jury", "scorer"]] = None
    if p.user_id:
        u = db.query(models.User).filter(models.User.id == p.user_id).first()
        if u:
            username = u.username
            if u.role in ("jury", "scorer"):
                credentials_role = u.role
    return JuryProfileRead(
        id=p.id,
        regatta_id=p.regatta_id,
        display_name=p.display_name,
        note=p.note,
        has_credentials=p.user_id is not None,
        username=username,
        credentials_role=credentials_role,
    )


def _issue_credentials(
    db: Session,
    regatta: models.Regatta,
    p: models.RegattaJuryProfile,
    role: Literal["jury", "scorer"],
) -> JuryCredentialsOut:
    """Create user or reset password; commit DB."""
    regatta_id = regatta.id
    # Short password (~8 chars); still cryptographically random
    password = secrets.token_urlsafe(6)
    email = f"{role}.p{p.id}.r{regatta_id}@{role}.internal"
    org_id = regatta.organization_id

    if p.user_id:
        u = db.query(models.User).filter(models.User.id == p.user_id).first()
        if not u:
            p.user_id = None
        else:
            u.hashed_password = hash_password(password)
            u.name = p.display_name
            u.role = role
            u.is_active = True
            db.commit()
            db.refresh(u)
            return JuryCredentialsOut(
                username=u.username,
                password=password,
                role=role,
                message="New password generated. Save it now; it will not be shown again.",
            )

    if (
        db.query(models.User)
        .filter(models.User.organization_id == org_id, models.User.email == email)
        .first()
    ):
        email = f"{role}.p{p.id}.r{regatta_id}.{secrets.token_hex(3)}@{role}.internal"

    username = make_unique_username(db, org_id, f"{role}_r{regatta_id}_p{p.id}")

    new_user = models.User(
        organization_id=org_id,
        name=p.display_name,
        email=email,
        username=username,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(new_user)
    db.flush()
    p.user_id = new_user.id
    db.commit()
    db.refresh(new_user)

    return JuryCredentialsOut(
        username=new_user.username,
        password=password,
        role=role,
    )


@router.get("/{regatta_id}/jury-profiles", response_model=List[JuryProfileRead])
def list_jury_profiles(
    regatta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    regatta = _get_regatta(db, regatta_id)
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    rows = (
        db.query(models.RegattaJuryProfile)
        .filter(models.RegattaJuryProfile.regatta_id == regatta_id)
        .order_by(models.RegattaJuryProfile.id.asc())
        .all()
    )
    return [_to_read(db, p) for p in rows]


@router.post(
    "/{regatta_id}/jury-profiles",
    response_model=JuryProfileCreateResult,
    status_code=status.HTTP_201_CREATED,
)
def create_jury_profile(
    regatta_id: int,
    body: JuryProfileCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    regatta = _get_regatta(db, regatta_id)
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    p = models.RegattaJuryProfile(
        regatta_id=regatta_id,
        display_name=body.display_name.strip(),
        note=(body.note.strip() if body.note else None) or None,
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    creds: Optional[JuryCredentialsOut] = None
    if body.auto_generate_credentials:
        creds = _issue_credentials(db, regatta, p, body.credentials_role)
        db.refresh(p)

    return JuryProfileCreateResult(profile=_to_read(db, p), credentials=creds)


@router.patch("/{regatta_id}/jury-profiles/{profile_id}", response_model=JuryProfileRead)
def update_jury_profile(
    regatta_id: int,
    profile_id: int,
    body: JuryProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    regatta = _get_regatta(db, regatta_id)
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    p = _profile_for_regatta(db, regatta_id, profile_id)
    if body.display_name is not None:
        p.display_name = body.display_name.strip()
    if body.note is not None:
        p.note = body.note.strip() or None
    db.commit()
    db.refresh(p)
    if p.user_id:
        u = db.query(models.User).filter(models.User.id == p.user_id).first()
        if u:
            u.name = p.display_name
            db.commit()
    return _to_read(db, p)


@router.delete("/{regatta_id}/jury-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_jury_profile(
    regatta_id: int,
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    regatta = _get_regatta(db, regatta_id)
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    p = _profile_for_regatta(db, regatta_id, profile_id)
    if p.user_id:
        u = db.query(models.User).filter(models.User.id == p.user_id).first()
        if u:
            db.delete(u)
    db.delete(p)
    db.commit()
    return None


class GenerateCredentialsBody(BaseModel):
    credentials_role: Optional[Literal["jury", "scorer"]] = None


@router.post(
    "/{regatta_id}/jury-profiles/{profile_id}/credentials",
    response_model=JuryCredentialsOut,
)
def generate_jury_credentials(
    regatta_id: int,
    profile_id: int,
    body: GenerateCredentialsBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    regatta = _get_regatta(db, regatta_id)
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    p = _profile_for_regatta(db, regatta_id, profile_id)
    role_to_issue: Literal["jury", "scorer"] = "jury"
    # Safety rule: for existing linked accounts, preserve current role on password regeneration.
    # This avoids accidental role flips from stale UI state.
    if p.user_id:
        u = db.query(models.User).filter(models.User.id == p.user_id).first()
        if u and u.role in ("jury", "scorer"):
            role_to_issue = u.role
        elif body.credentials_role in ("jury", "scorer"):
            role_to_issue = body.credentials_role
    elif body.credentials_role in ("jury", "scorer"):
        role_to_issue = body.credentials_role
    return _issue_credentials(db, regatta, p, role_to_issue)
