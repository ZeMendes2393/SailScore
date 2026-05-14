# app/routes/protest_time_limit.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.org_scope import assert_user_can_manage_org_id
from utils.auth_utils import verify_role

router = APIRouter(prefix="/ptl", tags=["protest-time-limit"])

@router.get("/{regatta_id}")
def list_ptl(regatta_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(models.ProtestTimeLimit)
        .filter(models.ProtestTimeLimit.regatta_id == regatta_id)
        .order_by(models.ProtestTimeLimit.date.desc(), models.ProtestTimeLimit.class_name.asc())
        .all()
    )
    # devolve uma lista simples (ou adapta para o formato que já usas no FE)
    return [
        {
            "id": r.id,
            "regatta_id": r.regatta_id,
            "class_name": r.class_name,
            "fleet": r.fleet,
            "time_limit_hm": r.time_limit_hm,
            "date": r.date.isoformat(),
        }
        for r in rows
    ]

@router.post("/", dependencies=[Depends(verify_role(["admin"]))])
def create_ptl(
    payload: schemas.PTLCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    regatta = db.query(models.Regatta).filter_by(id=payload.regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    # unicidade
    exists = (
        db.query(models.ProtestTimeLimit.id)
        .filter(
            models.ProtestTimeLimit.regatta_id == payload.regatta_id,
            models.ProtestTimeLimit.class_name == payload.class_name,
            models.ProtestTimeLimit.fleet == payload.fleet,
            models.ProtestTimeLimit.date == payload.date,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="A record already exists for this class/fleet/date")

    row = models.ProtestTimeLimit(
        regatta_id=payload.regatta_id,
        class_name=payload.class_name,
        fleet=payload.fleet,
        time_limit_hm=payload.time_limit_hm,  # ✅ HH:MM
        date=payload.date,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"ok": True, "id": row.id}

@router.patch("/{row_id}", dependencies=[Depends(verify_role(["admin"]))])
def patch_ptl(
    row_id: int,
    payload: schemas.PTLPatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    row = db.query(models.ProtestTimeLimit).filter(models.ProtestTimeLimit.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    regatta = db.query(models.Regatta).filter_by(id=row.regatta_id).first()
    if regatta:
        assert_user_can_manage_org_id(current_user, regatta.organization_id)

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)

    db.add(row)
    db.commit()
    db.refresh(row)
    return {"ok": True}

@router.delete("/{row_id}", dependencies=[Depends(verify_role(["admin"]))])
def delete_ptl(
    row_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    row = db.query(models.ProtestTimeLimit).filter(models.ProtestTimeLimit.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    regatta = db.query(models.Regatta).filter_by(id=row.regatta_id).first()
    if regatta:
        assert_user_can_manage_org_id(current_user, regatta.organization_id)
    db.delete(row)
    db.commit()
    return {"ok": True}
