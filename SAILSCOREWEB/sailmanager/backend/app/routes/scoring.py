# app/routes/scoring.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, String

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user, get_current_user_optional

router = APIRouter(prefix="/regattas/{regatta_id}/scoring", tags=["scoring"])


def _is_entry_mine(entry: models.Entry, user: models.User) -> bool:
    if not entry:
        return False
    if entry.user_id and user.id and entry.user_id == user.id:
        return True
    # fallback by email
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

    # Non-admin sailors can only create for their own entry
    if current_user.role != "admin" and not _is_entry_mine(entry, current_user):
        raise HTTPException(status_code=403, detail="Not allowed to create for this entry")

    # Keep integrity: prefer entry class/sail if present
    class_name = entry.class_name or (body.class_name or None)
    sail_number = entry.sail_number or (body.sail_number or None)

    item = models.ScoringEnquiry(
        regatta_id=regatta_id,
        initiator_entry_id=body.initiator_entry_id,
        race_id=body.race_id,
        race_number=(body.race_number or None),
        class_name=(class_name or None),
        sail_number=(sail_number or None),

        requested_change=(body.requested_change or None),
        requested_score=body.requested_score,
        boat_ahead=(body.boat_ahead or None),
        boat_behind=(body.boat_behind or None),

        status="submitted",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("", response_model=List[schemas.ScoringRead])
def list_scoring(
    regatta_id: int,
    # accept both; use the first provided
    status_q: Optional[str] = Query(None),
    status_eq: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    public: bool = Query(False, description="when true, allow unauthenticated public listing"),
    mine: bool = Query(False, description="ignored; non-admin users are always scoped to their entries"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    """
    Public (no token) + public=true: returns ALL enquiries for the regatta (any status),
      optionally filtered by status/search if provided.
    Auth non-admin: only enquiries for user's entries.
    Admin: all enquiries.
    """
    _require_regatta(db, regatta_id)

    eff_status = status_q or status_eq
    q = db.query(models.ScoringEnquiry).filter(models.ScoringEnquiry.regatta_id == regatta_id)

    # Visitor (no token)
    if current_user is None:
        if not public:
            # keep public pages from triggering redirects elsewhere
            return []
        # public=true → show ALL statuses unless a filter is provided
        if eff_status and eff_status != "all":
            q = q.filter(models.ScoringEnquiry.status == eff_status)
        if search:
            s = f"%{(search or '').strip().lower()}%"
            q = q.filter(or_(
                func.lower(func.coalesce(models.ScoringEnquiry.sail_number, "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.class_name, "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.race_number, "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.requested_change, "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.boat_ahead, "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.boat_behind, "")).like(s),
                func.lower(func.coalesce(cast(models.ScoringEnquiry.requested_score, String), "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.response, "")).like(s),
            ))
        return q.order_by(models.ScoringEnquiry.created_at.desc()).all()

    # Admin
    if current_user.role == "admin":
        if eff_status and eff_status != "all":
            q = q.filter(models.ScoringEnquiry.status == eff_status)
        if search:
            s = f"%{(search or '').strip().lower()}%"
            q = q.filter(or_(
                func.lower(func.coalesce(models.ScoringEnquiry.sail_number, "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.class_name, "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.race_number, "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.requested_change, "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.boat_ahead, "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.boat_behind, "")).like(s),
                func.lower(func.coalesce(cast(models.ScoringEnquiry.requested_score, String), "")).like(s),
                func.lower(func.coalesce(models.ScoringEnquiry.response, "")).like(s),
            ))
        return q.order_by(models.ScoringEnquiry.created_at.desc()).all()

    # Authenticated non-admin → restrict to user's entries
    my_entries_ids = [
        e.id
        for e in db.query(models.Entry)
        .filter(models.Entry.regatta_id == regatta_id)
        .filter(or_(
            models.Entry.user_id == current_user.id,
            func.lower(models.Entry.email) == func.lower(current_user.email),
        )).all()
    ]
    if not my_entries_ids:
        return []

    q = q.filter(models.ScoringEnquiry.initiator_entry_id.in_(my_entries_ids))

    if eff_status and eff_status != "all":
        q = q.filter(models.ScoringEnquiry.status == eff_status)
    if search:
        s = f"%{(search or '').strip().lower()}%"
        q = q.filter(or_(
            func.lower(func.coalesce(models.ScoringEnquiry.sail_number, "")).like(s),
            func.lower(func.coalesce(models.ScoringEnquiry.class_name, "")).like(s),
            func.lower(func.coalesce(models.ScoringEnquiry.race_number, "")).like(s),
            func.lower(func.coalesce(models.ScoringEnquiry.requested_change, "")).like(s),
            func.lower(func.coalesce(models.ScoringEnquiry.boat_ahead, "")).like(s),
            func.lower(func.coalesce(models.ScoringEnquiry.boat_behind, "")).like(s),
            func.lower(func.coalesce(cast(models.ScoringEnquiry.requested_score, String), "")).like(s),
            func.lower(func.coalesce(models.ScoringEnquiry.response, "")).like(s),
        ))
    return q.order_by(models.ScoringEnquiry.created_at.desc()).all()


@router.get("/{enquiry_id}", response_model=schemas.ScoringRead)
def get_scoring(
    regatta_id: int,
    enquiry_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    item = db.query(models.ScoringEnquiry).filter(
        models.ScoringEnquiry.id == enquiry_id,
        models.ScoringEnquiry.regatta_id == regatta_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Scoring enquiry not found")

    # Visitor can view any item when public pages are used
    if current_user is None:
        return item

    # Authenticated non-admin must own the entry; admin can view all
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

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(item, k, v)

    db.commit()
    db.refresh(item)
    return item
