# app/routes/rule42.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app import models, schemas
from utils.auth_utils import verify_role

router = APIRouter(prefix="/rule42", tags=["rule42"])

# LISTAR
@router.get("/{regatta_id}", response_model=List[schemas.Rule42Out])
def list_rule42(
    regatta_id: int,
    class_name: Optional[str] = Query(None),
    sail_num: Optional[str] = Query(None),
    race: Optional[str] = Query(None),
    group: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Rule42Record).filter(models.Rule42Record.regatta_id == regatta_id)
    if class_name:
        q = q.filter(models.Rule42Record.class_name == class_name)
    if sail_num:
        q = q.filter(models.Rule42Record.sail_num == sail_num)
    if race:
        q = q.filter(models.Rule42Record.race == race)
    if group:
        q = q.filter(models.Rule42Record.group == group)
    return q.order_by(models.Rule42Record.date.desc(), models.Rule42Record.id.desc()).all()

# CRIAR (ADMIN)
@router.post(
    "/",
    response_model=schemas.Rule42Out,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_role(["admin"]))],
)
def create_rule42(payload: schemas.Rule42Create, db: Session = Depends(get_db)):
    rec = models.Rule42Record(**payload.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec

# EDITAR (ADMIN)  ← NOVO
@router.patch(
    "/{id}",
    response_model=schemas.Rule42Out,
    dependencies=[Depends(verify_role(["admin"]))],
)
def update_rule42(id: int, payload: schemas.Rule42Patch, db: Session = Depends(get_db)):
    rec = db.query(models.Rule42Record).filter(models.Rule42Record.id == id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Registo não encontrado")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(rec, k, v)

    db.commit()
    db.refresh(rec)
    return rec

# APAGAR (ADMIN)
@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_role(["admin"]))],
)
def delete_rule42(id: int, db: Session = Depends(get_db)):
    rec = db.query(models.Rule42Record).filter(models.Rule42Record.id == id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    db.delete(rec)
    db.commit()
    return
