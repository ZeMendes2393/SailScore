"""Helper to resolve organization from slug for multi-tenant context."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models

DEFAULT_ORG_SLUG = "sailscore"


def resolve_org(db: Session, org_slug: str | None = None, org_id: int | None = None) -> models.Organization:
    """Resolve organization by slug or id. Defaults to sailscore when neither provided."""
    if org_id is not None:
        org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    elif org_slug:
        org = db.query(models.Organization).filter(models.Organization.slug == org_slug).first()
    else:
        org = db.query(models.Organization).filter(models.Organization.slug == DEFAULT_ORG_SLUG).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    if not org.is_active:
        raise HTTPException(status_code=404, detail="Organização inativa")
    return org


def assert_user_can_manage_organization(user: models.User, organization: models.Organization) -> None:
    """platform_admin: qualquer org; admin: só a sua organização."""
    if user.role == "platform_admin":
        return
    if user.role == "admin" and user.organization_id == organization.id:
        return
    raise HTTPException(status_code=403, detail="Sem permissão para esta organização.")


def assert_user_can_manage_org_id(user: models.User, organization_id: int) -> None:
    if user.role == "platform_admin":
        return
    if user.role == "admin" and user.organization_id == organization_id:
        return
    raise HTTPException(status_code=403, detail="Sem permissão para esta organização.")
