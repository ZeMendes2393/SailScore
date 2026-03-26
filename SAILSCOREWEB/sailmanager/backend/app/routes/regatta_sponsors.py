# app/routes/regatta_sponsors.py
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.org_scope import assert_user_can_manage_organization, assert_user_can_manage_org_id, resolve_org
from utils.auth_utils import verify_role, get_current_user_optional

router = APIRouter()


def _effective_org_slug_for_sponsor_scope(
    db: Session,
    org: Optional[str],
    current_user: Optional[models.User],
) -> Optional[str]:
    """Admin de organização: sempre a sua org (ignora ?org= na URL). Platform / público: query ou default."""
    if current_user is not None and current_user.role == "admin" and current_user.organization_id:
        row = (
            db.query(models.Organization)
            .filter(models.Organization.id == current_user.organization_id)
            .first()
        )
        if row:
            return row.slug
    return org


def _org_id_from_slug(db: Session, org_slug: Optional[str]) -> int:
    organization = resolve_org(db, org_slug=org_slug)
    return organization.id


@router.get("/sponsors/categories", response_model=List[str])
def list_sponsor_categories(
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    """Lista categorias de sponsors da organização (para dropdown partilhado)."""
    effective = _effective_org_slug_for_sponsor_scope(db, org, current_user)
    org_id = _org_id_from_slug(db, effective)
    rows = (
        db.query(models.RegattaSponsor.category)
        .distinct()
        .filter(
            models.RegattaSponsor.organization_id == org_id,
            models.RegattaSponsor.category.isnot(None),
            models.RegattaSponsor.category != "",
        )
        .order_by(models.RegattaSponsor.category)
        .all()
    )
    return [r[0] for r in rows if r[0]]


@router.get("/sponsors", response_model=List[schemas.RegattaSponsorRead])
def list_global_sponsors(
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    """Lista sponsors globais da organização (regatta_id NULL) para homepage, calendar, news."""
    effective = _effective_org_slug_for_sponsor_scope(db, org, current_user)
    org_id = _org_id_from_slug(db, effective)
    sponsors = (
        db.query(models.RegattaSponsor)
        .filter(
            models.RegattaSponsor.regatta_id.is_(None),
            models.RegattaSponsor.organization_id == org_id,
        )
        .order_by(models.RegattaSponsor.category, models.RegattaSponsor.sort_order)
        .all()
    )
    return sponsors


@router.post("/sponsors", response_model=schemas.RegattaSponsorRead, status_code=201)
def create_global_sponsor(
    body: schemas.RegattaSponsorCreate,
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    """Criar sponsor global da organização (aparece na homepage, calendar, news)."""
    effective = _effective_org_slug_for_sponsor_scope(db, org, current_user)
    organization = resolve_org(db, org_slug=effective)
    assert_user_can_manage_organization(current_user, organization)
    org_id = organization.id
    item = models.RegattaSponsor(
        organization_id=org_id,
        regatta_id=None,
        category=body.category.strip(),
        image_url=body.image_url.strip(),
        link_url=body.link_url.strip() if body.link_url else None,
        sort_order=body.sort_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/sponsors/{sponsor_id}", response_model=schemas.RegattaSponsorRead)
def update_global_sponsor(
    sponsor_id: int,
    body: schemas.RegattaSponsorUpdate,
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    """Atualizar sponsor global (admin)."""
    effective = _effective_org_slug_for_sponsor_scope(db, org, current_user)
    organization = resolve_org(db, org_slug=effective)
    assert_user_can_manage_organization(current_user, organization)
    org_id = organization.id
    item = (
        db.query(models.RegattaSponsor)
        .filter(
            models.RegattaSponsor.id == sponsor_id,
            models.RegattaSponsor.regatta_id.is_(None),
            models.RegattaSponsor.organization_id == org_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if k == "category" and v is not None:
            setattr(item, k, v.strip())
        elif k == "image_url" and v is not None:
            setattr(item, k, v.strip())
        elif k == "link_url":
            setattr(item, k, v.strip() if v else None)
        elif k in ("sort_order",):
            setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/sponsors/{sponsor_id}", status_code=204)
def delete_global_sponsor(
    sponsor_id: int,
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    """Eliminar sponsor global (admin)."""
    effective = _effective_org_slug_for_sponsor_scope(db, org, current_user)
    organization = resolve_org(db, org_slug=effective)
    assert_user_can_manage_organization(current_user, organization)
    org_id = organization.id
    item = (
        db.query(models.RegattaSponsor)
        .filter(
            models.RegattaSponsor.id == sponsor_id,
            models.RegattaSponsor.regatta_id.is_(None),
            models.RegattaSponsor.organization_id == org_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    db.delete(item)
    db.commit()
    return None


@router.get("/regattas/{regatta_id}/sponsors", response_model=List[schemas.RegattaSponsorRead])
def list_sponsors(regatta_id: int, db: Session = Depends(get_db)):
    """Lista os sponsors/apoios da regata (global da org + específicos)."""
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    sponsors = (
        db.query(models.RegattaSponsor)
        .filter(
            or_(
                and_(
                    models.RegattaSponsor.regatta_id.is_(None),
                    models.RegattaSponsor.organization_id == regatta.organization_id,
                ),
                models.RegattaSponsor.regatta_id == regatta_id,
            )
        )
        .order_by(models.RegattaSponsor.category, models.RegattaSponsor.sort_order)
        .all()
    )
    return sponsors


@router.post("/regattas/{regatta_id}/sponsors", response_model=schemas.RegattaSponsorRead, status_code=201)
def create_sponsor(
    regatta_id: int,
    body: schemas.RegattaSponsorCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    """Criar um sponsor/apoio para a regata ou global da org (admin)."""
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    effective_regatta_id = None if body.add_to_all_events else regatta_id
    item = models.RegattaSponsor(
        organization_id=regatta.organization_id,
        regatta_id=effective_regatta_id,
        category=body.category.strip(),
        image_url=body.image_url.strip(),
        link_url=body.link_url.strip() if body.link_url else None,
        sort_order=body.sort_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/regattas/{regatta_id}/sponsors/{sponsor_id}", response_model=schemas.RegattaSponsorRead)
def update_sponsor(
    regatta_id: int,
    sponsor_id: int,
    body: schemas.RegattaSponsorUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    """Atualizar um sponsor (admin). Pode editar global (regatta_id null) a partir de qualquer regata."""
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    item = (
        db.query(models.RegattaSponsor)
        .filter(models.RegattaSponsor.id == sponsor_id)
        .filter(
            or_(
                models.RegattaSponsor.regatta_id.is_(None),
                models.RegattaSponsor.regatta_id == regatta_id,
            )
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if k == "category" and v is not None:
            setattr(item, k, v.strip())
        elif k == "image_url" and v is not None:
            setattr(item, k, v.strip())
        elif k == "link_url":
            setattr(item, k, v.strip() if v else None)
        elif k in ("sort_order",):
            setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/regattas/{regatta_id}/sponsors/{sponsor_id}", status_code=204)
def delete_sponsor(
    regatta_id: int,
    sponsor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    """Eliminar um sponsor (admin). Pode eliminar global (regatta_id null) a partir de qualquer regata."""
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    item = (
        db.query(models.RegattaSponsor)
        .filter(models.RegattaSponsor.id == sponsor_id)
        .filter(
            or_(
                models.RegattaSponsor.regatta_id.is_(None),
                models.RegattaSponsor.regatta_id == regatta_id,
            )
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    db.delete(item)
    db.commit()
    return None
