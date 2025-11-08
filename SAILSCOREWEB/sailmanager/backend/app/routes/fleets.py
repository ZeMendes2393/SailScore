# app/routes/fleets.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.models import FleetSet, Fleet, FleetAssignment, Race
from app.services.fleets import create_initial_set_random, reshuffle_from_ranking, start_finals

from app.schemas import (
    FleetSetRead, FleetRead, FleetAssignmentRead,
    CreateQualifyingSetIn, ReshuffleIn, StartFinalsIn
)


router = APIRouter(prefix="/regattas", tags=["fleets"])

@router.post("/{regatta_id}/classes/{class_name}/fleet-sets/qualifying", response_model=FleetSetRead)
def create_quali_set(regatta_id: int, class_name: str, body: CreateQualifyingSetIn, db: Session = Depends(get_db)):
    fs = create_initial_set_random(db, regatta_id, class_name, body.label, body.num_fleets)
    db.commit(); db.refresh(fs)
    # opcional: ligar às races fornecidas
    if body.race_ids:
        db.query(Race).filter(Race.id.in_(body.race_ids)).update({"fleet_set_id": fs.id}, synchronize_session=False)
        db.commit()
    db.refresh(fs)
    return fs

@router.post("/{regatta_id}/classes/{class_name}/fleet-sets/{prev_set_id}/reshuffle", response_model=FleetSetRead)
def reshuffle(regatta_id: int, class_name: str, prev_set_id: int, body: ReshuffleIn, db: Session = Depends(get_db)):
    try:
        fs = reshuffle_from_ranking(db, regatta_id, class_name, prev_set_id, body.label, body.num_fleets)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit(); db.refresh(fs)
    if body.race_ids:
        db.query(Race).filter(Race.id.in_(body.race_ids)).update({"fleet_set_id": fs.id}, synchronize_session=False)
        db.commit()
    db.refresh(fs)
    return fs

@router.post("/{regatta_id}/classes/{class_name}/fleet-sets/finals", response_model=FleetSetRead)
def start_finals_set(regatta_id: int, class_name: str, body: StartFinalsIn, db: Session = Depends(get_db)):
    fs = start_finals(db, regatta_id, class_name, body.label or "Finals", body.grouping)
    db.commit(); db.refresh(fs)
    if body.race_ids:
        db.query(Race).filter(Race.id.in_(body.race_ids)).update({"fleet_set_id": fs.id}, synchronize_session=False)
        db.commit()
    db.refresh(fs)
    return fs

@router.get("/{regatta_id}/classes/{class_name}/fleet-sets", response_model=List[FleetSetRead])
def list_sets(regatta_id: int, class_name: str, phase: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(FleetSet).filter(FleetSet.regatta_id==regatta_id, FleetSet.class_name==class_name)
    if phase: q = q.filter(FleetSet.phase==phase)
    return q.order_by(FleetSet.created_at.asc()).all()

@router.get("/{regatta_id}/classes/{class_name}/fleet-sets/{set_id}/assignments")
def list_assignments(regatta_id: int, class_name: str, set_id: int, db: Session = Depends(get_db)):
    fs = db.query(FleetSet).filter_by(id=set_id, regatta_id=regatta_id, class_name=class_name).first()
    if not fs: raise HTTPException(404, "Fleet set não encontrado")
    rows = db.query(FleetAssignment.entry_id, FleetAssignment.fleet_id).filter(FleetAssignment.fleet_set_id==set_id).all()
    return {"fleet_set_id": set_id, "assignments": [{"entry_id": e, "fleet_id": f} for (e,f) in rows]}
