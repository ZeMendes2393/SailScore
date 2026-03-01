# app/routes/regatta_sponsors.py
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from utils.auth_utils import verify_role

router = APIRouter()


@router.get("/regattas/{regatta_id}/sponsors", response_model=List[schemas.RegattaSponsorRead])
def list_sponsors(regatta_id: int, db: Session = Depends(get_db)):
    """Lista os sponsors/apoios da regata (global + específicos)."""
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    sponsors = (
        db.query(models.RegattaSponsor)
        .filter(
            or_(
                models.RegattaSponsor.regatta_id.is_(None),
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
    """Criar um sponsor/apoio para a regata ou global (admin)."""
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    effective_regatta_id = None if body.add_to_all_events else regatta_id
    item = models.RegattaSponsor(
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
