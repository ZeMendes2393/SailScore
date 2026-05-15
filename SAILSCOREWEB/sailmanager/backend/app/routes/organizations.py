from __future__ import annotations

import re
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import EmailStr
from sqlalchemy.orm import Session

from app import models, schemas
from app.default_footer_legal_texts import (
    DEFAULT_FOOTER_COOKIE_POLICY_TEXT,
    DEFAULT_FOOTER_PRIVACY_POLICY_TEXT,
    DEFAULT_FOOTER_TERMS_OF_SERVICE_TEXT,
)
from app.auth_helpers import make_unique_username
from app.database import get_db
from app.org_scope import assert_user_can_manage_organization
from utils.auth_utils import get_current_user, hash_password

router = APIRouter(prefix="/organizations", tags=["organizations"])

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_PROVISIONAL_ORG_MANAGEMENT_SLUGS = {"example-sailing-club"}
_SUPER_ADMIN_MANAGER_EMAILS = {
    e.strip().lower()
    for e in os.getenv("SUPER_ADMIN_ORG_MANAGER_EMAILS", "jose.mendes2691@gmail.com").split(",")
    if e.strip()
}


def _is_provisional_org_manager(db: Session, current_user: models.User) -> bool:
    if current_user.role != "admin":
        return False
    org = db.query(models.Organization).filter(models.Organization.id == current_user.organization_id).first()
    return bool(org and org.slug in _PROVISIONAL_ORG_MANAGEMENT_SLUGS)


def _is_super_admin_manager(current_user: models.User) -> bool:
    email = (current_user.email or "").strip().lower()
    return bool(email and email in _SUPER_ADMIN_MANAGER_EMAILS)


def _require_platform_admin(db: Session, current_user: models.User) -> None:
    if current_user.role == "platform_admin":
        return
    if _is_provisional_org_manager(db, current_user):
        return
    if _is_super_admin_manager(current_user):
        return
    if current_user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Platform administrators only.")


def _require_staff(current_user: models.User) -> None:
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Access denied")


def _normalize_slug(slug: str) -> str:
    s = (slug or "").strip().lower()
    if not s:
        raise HTTPException(status_code=400, detail="Slug is required")
    if not _SLUG_RE.fullmatch(s):
        raise HTTPException(
            status_code=400,
            detail="Invalid slug. Use lowercase letters, numbers and hyphens only.",
        )
    return s


def _normalize_name(name: str) -> str:
    s = (name or "").strip()
    if not s:
        raise HTTPException(status_code=400, detail="Name is required")
    return s


@router.get("", response_model=List[schemas.OrganizationRead])
@router.get("/", response_model=List[schemas.OrganizationRead], include_in_schema=False)
def list_organizations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_staff(current_user)
    if (
        current_user.role == "platform_admin"
        or _is_provisional_org_manager(db, current_user)
        or _is_super_admin_manager(current_user)
    ):
        return (
            db.query(models.Organization)
            .order_by(models.Organization.name.asc(), models.Organization.id.asc())
            .all()
        )
    return (
        db.query(models.Organization)
        .filter(models.Organization.id == current_user.organization_id)
        .order_by(models.Organization.name.asc())
        .all()
    )


@router.get("/by-slug/{slug}", response_model=schemas.OrganizationRead)
def get_organization_by_slug(slug: str, db: Session = Depends(get_db)):
    """Public: get org by slug (for frontend to validate and show org site)."""
    org = db.query(models.Organization).filter(models.Organization.slug == slug).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not org.is_active:
        raise HTTPException(status_code=404, detail="Organization is inactive")
    return org


@router.get("/{organization_id}", response_model=schemas.OrganizationReadWithAdmin)
def get_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_staff(current_user)
    org = db.query(models.Organization).filter(models.Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if (
        current_user.role == "admin"
        and current_user.organization_id != organization_id
        and not _is_provisional_org_manager(db, current_user)
        and not _is_super_admin_manager(current_user)
    ):
        raise HTTPException(status_code=403, detail="Access denied for this organization.")
    admin = (
        db.query(models.User)
        .filter(
            models.User.organization_id == organization_id,
            models.User.role == "admin",
        )
        .first()
    )
    return {
        **schemas.OrganizationRead.model_validate(org).model_dump(),
        "admin_email": admin.email if admin else None,
    }


@router.post("", response_model=schemas.OrganizationRead)
@router.post("/", response_model=schemas.OrganizationRead, include_in_schema=False)
def create_organization(
    body: schemas.OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_platform_admin(db, current_user)

    name = _normalize_name(body.name)
    slug = _normalize_slug(body.slug)

    exists = db.query(models.Organization).filter(models.Organization.slug == slug).first()
    if exists:
        raise HTTPException(status_code=409, detail="Organization slug already exists")

    admin_email = (body.admin_email or "").strip().lower() if body.admin_email else None
    admin_password = body.admin_password or ""
    admin_name = (body.admin_name or "").strip() if body.admin_name else None

    if admin_email and len(admin_password) < 8:
        raise HTTPException(status_code=400, detail="Admin password: at least 8 characters.")
    if admin_password and not admin_email:
        raise HTTPException(status_code=400, detail="Provide the admin email if you want to set a password.")

    org = models.Organization(
        name=name,
        slug=slug,
        is_active=body.is_active,
    )
    db.add(org)
    db.flush()  # get org.id
    site_design = models.SiteDesign(
        organization_id=org.id,
        featured_regatta_ids=[],
        home_images=None,
        hero_title=None,
        hero_subtitle=None,
        club_logo_url=None,
        club_logo_link=None,
        footer_site_name=None,
        footer_tagline=None,
        footer_contact_email=None,
        footer_phone=None,
        footer_address=None,
        footer_instagram_url=None,
        footer_facebook_url=None,
        footer_privacy_policy_text=DEFAULT_FOOTER_PRIVACY_POLICY_TEXT,
        footer_terms_of_service_text=DEFAULT_FOOTER_TERMS_OF_SERVICE_TEXT,
        footer_cookie_policy_text=DEFAULT_FOOTER_COOKIE_POLICY_TEXT,
    )
    db.add(site_design)

    if admin_email:
        dup = (
            db.query(models.User)
            .filter(
                models.User.email == admin_email,
                models.User.organization_id == org.id,
            )
            .first()
        )
        if dup:
            raise HTTPException(status_code=409, detail="A user with this email already exists in this organization.")
        uname = make_unique_username(db, org.id, admin_email.split("@")[0])
        admin_user = models.User(
            organization_id=org.id,
            name=admin_name,
            email=admin_email,
            username=uname,
            hashed_password=hash_password(admin_password),
            role="admin",
            is_active=True,
        )
        db.add(admin_user)

    db.commit()
    db.refresh(org)
    return org


@router.patch("/{organization_id}", response_model=schemas.OrganizationReadWithAdmin)
def update_organization(
    organization_id: int,
    body: schemas.OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_platform_admin(db, current_user)

    org = db.query(models.Organization).filter(models.Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    data = body.model_dump(exclude_unset=True)

    if "name" in data:
        org.name = _normalize_name(data["name"])

    if "slug" in data:
        new_slug = _normalize_slug(data["slug"])
        exists = (
            db.query(models.Organization)
            .filter(models.Organization.slug == new_slug, models.Organization.id != organization_id)
            .first()
        )
        if exists:
            raise HTTPException(status_code=409, detail="Organization slug already exists")
        org.slug = new_slug

    if "is_active" in data:
        org.is_active = bool(data["is_active"])

    admin_email = (data.pop("admin_email", None) or "").strip().lower() or None
    admin_password = data.pop("admin_password", None)
    admin_user = (
        db.query(models.User)
        .filter(
            models.User.organization_id == organization_id,
            models.User.role == "admin",
        )
        .first()
    )

    if admin_email is not None or admin_password is not None:
        if admin_user:
            if admin_email is not None:
                if admin_email:
                    dup = (
                        db.query(models.User)
                        .filter(
                            models.User.email == admin_email,
                            models.User.organization_id == organization_id,
                            models.User.id != admin_user.id,
                        )
                        .first()
                    )
                    if dup:
                        raise HTTPException(
                            status_code=409,
                            detail="Another user with this email already exists in this organization.",
                        )
                    admin_user.email = admin_email
                    admin_user.username = make_unique_username(db, organization_id, admin_email.split("@")[0])
                else:
                    raise HTTPException(status_code=400, detail="Admin email cannot be empty.")
            if admin_password is not None and admin_password:
                if len(admin_password) < 8:
                    raise HTTPException(status_code=400, detail="Admin password: at least 8 characters.")
                admin_user.hashed_password = hash_password(admin_password)
        else:
            if admin_email and admin_password:
                if len(admin_password) < 8:
                    raise HTTPException(status_code=400, detail="Admin password: at least 8 characters.")
                dup = (
                    db.query(models.User)
                    .filter(
                        models.User.email == admin_email,
                        models.User.organization_id == organization_id,
                    )
                    .first()
                )
                if dup:
                    raise HTTPException(status_code=409, detail="A user with this email already exists in this organization.")
                uname = make_unique_username(db, organization_id, admin_email.split("@")[0])
                new_admin = models.User(
                    organization_id=organization_id,
                    email=admin_email,
                    username=uname,
                    hashed_password=hash_password(admin_password),
                    role="admin",
                    is_active=True,
                )
                db.add(new_admin)
            elif admin_email or admin_password:
                raise HTTPException(
                    status_code=400,
                    detail="To create an admin: provide email and password (min. 8 characters).",
                )

    db.commit()
    db.refresh(org)
    admin = (
        db.query(models.User)
        .filter(
            models.User.organization_id == organization_id,
            models.User.role == "admin",
        )
        .first()
    )
    return {
        **schemas.OrganizationRead.model_validate(org).model_dump(),
        "admin_email": admin.email if admin else None,
    }


@router.delete("/{organization_id}", status_code=204)
def delete_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_platform_admin(db, current_user)

    org = db.query(models.Organization).filter(models.Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    db.delete(org)
    db.commit()
    return
