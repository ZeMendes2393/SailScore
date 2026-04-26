"""Helper to resolve organization from slug for multi-tenant context."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models


def assert_staff_regatta_access(db: Session, user: models.User, regatta_id: int) -> None:
    """
    Admin/platform_admin: a regata tem de pertencer à organização gerida.
    Jury/Scorer: perfil staff para esta regata (RegattaJuryProfile).
    """
    from app.jury_scope import assert_jury_regatta_access

    if user.role == "jury":
        assert_jury_regatta_access(db, user, regatta_id)
        return
    if user.role == "scorer":
        regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
        if not regatta:
            raise HTTPException(status_code=404, detail="Regatta not found")
        if int(regatta.organization_id) != int(user.organization_id):
            raise HTTPException(status_code=403, detail="Sem permissão nesta regata (organização).")
        prof = (
            db.query(models.RegattaJuryProfile)
            .filter(models.RegattaJuryProfile.user_id == user.id)
            .first()
        )
        if not prof or int(prof.regatta_id) != int(regatta_id):
            raise HTTPException(status_code=403, detail="Sem permissão nesta regata.")
        return
    if user.role in ("admin", "platform_admin"):
        regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
        if not regatta:
            raise HTTPException(status_code=404, detail="Regatta not found")
        assert_user_can_manage_org_id(user, regatta.organization_id)
        return
    raise HTTPException(status_code=403, detail="Sem permissão para esta regata.")

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
