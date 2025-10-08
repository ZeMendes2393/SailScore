from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user

router = APIRouter(prefix="/regattas/{regatta_id}/scoring", tags=["scoring"])

def _is_entry_mine(entry: models.Entry, user: models.User) -> bool:
    if not entry:
        return False
    if entry.user_id and user.id and entry.user_id == user.id:
        return True
    # fallback por email
    return (entry.email or "").strip().lower() == (user.email or "").strip().lower()

def _require_regatta(db: Session, regatta_id: int) -> models.Regatta:
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regatta not found")
    return reg

@router.post("", response_model=schemas.ScoringRead, status_code=status.HTTP_201_CREATED)
def create_scoring(
    regatta_id: int,
    body: schemas.ScoringCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_regatta(db, regatta_id)

    entry = db.query(models.Entry).filter(models.Entry.id == body.initiator_entry_id).first()
    if not entry or entry.regatta_id != regatta_id:
        raise HTTPException(status_code=400, detail="Invalid initiator_entry_id for this regatta")

    # regatista só pode criar em nome da sua entry
    if current_user.role != "admin" and not _is_entry_mine(entry, current_user):
        raise HTTPException(status_code=403, detail="Not allowed to create for this entry")

    item = models.ScoringEnquiry(
        regatta_id=regatta_id,
        initiator_entry_id=body.initiator_entry_id,
        race_id=body.race_id,
        race_number=(body.race_number or None),
        class_name=(body.class_name or None),
        sail_number=(body.sail_number or None) or (entry.sail_number or None),
        reason=(body.reason or None),
        requested_change=(body.requested_change or None),
        status="submitted",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.get("", response_model=List[schemas.ScoringRead])
def list_scoring(
    regatta_id: int,
    status_eq: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    mine: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_regatta(db, regatta_id)

    q = db.query(models.ScoringEnquiry).filter(models.ScoringEnquiry.regatta_id == regatta_id)

    if current_user.role == "admin":
        if status_eq:
            q = q.filter(models.ScoringEnquiry.status == status_eq)
        if search:
            s = f"%{search.strip().lower()}%"
            q = q.filter(or_(
                func.lower(models.ScoringEnquiry.sail_number).like(s),
                func.lower(models.ScoringEnquiry.class_name).like(s),
                func.lower(models.ScoringEnquiry.race_number).like(s),
                func.lower(models.ScoringEnquiry.reason).like(s),
                func.lower(models.ScoringEnquiry.requested_change).like(s),
            ))
        return q.order_by(models.ScoringEnquiry.created_at.desc()).all()

    # regatista → só os seus (opcionalmente filtra por mine=true; aqui aplico sempre)
    my_entries_ids = [
        e.id for e in db.query(models.Entry)
        .filter(models.Entry.regatta_id == regatta_id)
        .filter(or_(
            models.Entry.user_id == current_user.id,
            func.lower(models.Entry.email) == func.lower(current_user.email),
        )).all()
    ]
    if not my_entries_ids:
        return []

    q = q.filter(models.ScoringEnquiry.initiator_entry_id.in_(my_entries_ids))
    if status_eq:
        q = q.filter(models.ScoringEnquiry.status == status_eq)
    if search:
        s = f"%{search.strip().lower()}%"
        q = q.filter(or_(
            func.lower(models.ScoringEnquiry.sail_number).like(s),
            func.lower(models.ScoringEnquiry.class_name).like(s),
            func.lower(models.ScoringEnquiry.race_number).like(s),
            func.lower(models.ScoringEnquiry.reason).like(s),
            func.lower(models.ScoringEnquiry.requested_change).like(s),
        ))
    return q.order_by(models.ScoringEnquiry.created_at.desc()).all()

@router.get("/{enquiry_id}", response_model=schemas.ScoringRead)
def get_scoring(
    regatta_id: int,
    enquiry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    item = db.query(models.ScoringEnquiry).filter(
        models.ScoringEnquiry.id == enquiry_id,
        models.ScoringEnquiry.regatta_id == regatta_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Scoring enquiry not found")

    if current_user.role != "admin":
        entry = db.query(models.Entry).filter(models.Entry.id == item.initiator_entry_id).first()
        if not _is_entry_mine(entry, current_user):
            raise HTTPException(status_code=403, detail="Not allowed")
    return item

@router.patch("/{enquiry_id}", response_model=schemas.ScoringRead)
def patch_scoring(
    regatta_id: int,
    enquiry_id: int,
    body: schemas.ScoringPatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can edit scoring enquiries")

    item = db.query(models.ScoringEnquiry).filter(
        models.ScoringEnquiry.id == enquiry_id,
        models.ScoringEnquiry.regatta_id == regatta_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Scoring enquiry not found")

    for k, v in body.dict(exclude_unset=True).items():
        setattr(item, k, v)

    db.commit()
    db.refresh(item)
    return item
