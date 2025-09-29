# app/routes/protest_time_limit.py
from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app import models, schemas
from utils.auth_utils import verify_role

router = APIRouter(prefix="/ptl", tags=["protest-time-limits"])

@router.get("/{regatta_id}")
def list_ptl(regatta_id: int, db: Session = Depends(get_db)):
    rows: List[models.ProtestTimeLimit] = (
        db.query(models.ProtestTimeLimit)
        .filter(models.ProtestTimeLimit.regatta_id == regatta_id)
        .order_by(
            models.ProtestTimeLimit.date.asc(),
            models.ProtestTimeLimit.class_name.asc(),
            models.ProtestTimeLimit.fleet.asc(),
        )
        .all()
    )
    return [
        {
            "id": r.id,
            "regatta_id": r.regatta_id,
            "class_name": r.class_name,
            "fleet": r.fleet,
            "date": r.date.isoformat() if r.date else None,
            "time_limit_minutes": r.time_limit_minutes,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]

@router.post("/", dependencies=[Depends(verify_role(["admin"]))], status_code=201)
def create_ptl(payload: schemas.ProtestTimeLimitCreate, db: Session = Depends(get_db)):
    obj = models.ProtestTimeLimit(
        regatta_id=payload.regatta_id,
        class_name=payload.class_name.strip(),
        fleet=(payload.fleet or None),
        date=payload.date,
        time_limit_minutes=int(payload.time_limit_minutes),
        notes=(payload.notes or None),
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Já existe time limit para (regatta, class, fleet, date).",
        )
    db.refresh(obj)
    return {
        "id": obj.id,
        "regatta_id": obj.regatta_id,
        "class_name": obj.class_name,
        "fleet": obj.fleet,
        "date": obj.date.isoformat() if obj.date else None,
        "time_limit_minutes": obj.time_limit_minutes,
        "notes": obj.notes,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }

# Mantive PATCH/DELETE caso precises no futuro; se não quiseres "Ações" no FE,
# podes simplesmente não expô-las no UI e deixar o backend preparado.

@router.patch("/{ptl_id}", dependencies=[Depends(verify_role(["admin"]))])
def update_ptl(ptl_id: int, payload: schemas.ProtestTimeLimitPatch, db: Session = Depends(get_db)):
    obj = db.query(models.ProtestTimeLimit).filter(models.ProtestTimeLimit.id == ptl_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Protest time limit não encontrado")
    patch = payload.model_dump(exclude_unset=True)
    for k, v in patch.items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Combinação duplicada.")
    db.refresh(obj)
    return {"ok": True}

@router.delete("/{ptl_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_role(["admin"]))])
def delete_ptl(ptl_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.ProtestTimeLimit).filter(models.ProtestTimeLimit.id == ptl_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Protest time limit não encontrado")
    db.delete(obj)
    db.commit()
    return
