# app/routes/regattas.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime, timedelta, timezone
import os

from app import models, schemas
from app.database import get_db
from utils.auth_utils import get_current_user

router = APIRouter()

# ---------------- Regattas CRUD ----------------

@router.get("/", response_model=List[schemas.RegattaRead])
def list_regattas(db: Session = Depends(get_db)):
    return db.query(models.Regatta).all()

@router.post("/", response_model=schemas.RegattaRead)
def create_regatta(regatta: schemas.RegattaCreate, db: Session = Depends(get_db)):
    new_regatta = models.Regatta(**regatta.dict())
    db.add(new_regatta)
    db.commit()
    db.refresh(new_regatta)
    return new_regatta

@router.get("/{regatta_id}", response_model=schemas.RegattaRead)
def get_regatta(regatta_id: int, db: Session = Depends(get_db)):
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regata não encontrada")
    return regatta


# ---------------- Scoring patch ----------------

class ScoringPatch(BaseModel):
    discard_count: int = Field(ge=0)
    discard_threshold: int = Field(ge=0)
    code_points: Optional[Dict[str, float]] = None  # pontos por código (DNF/DNC...)

@router.patch("/{regatta_id}/scoring", response_model=schemas.RegattaRead)
def update_scoring(
    regatta_id: int,
    body: ScoringPatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regata não encontrada")

    regatta.discard_count = body.discard_count
    regatta.discard_threshold = body.discard_threshold

    if body.code_points is not None:
        regatta.scoring_codes = {k.upper(): float(v) for k, v in body.code_points.items()}

    db.commit()
    db.refresh(regatta)
    return regatta

# ---------- MODELOS DE RESPOSTA ----------

class RegattaWindows(BaseModel):
    entryData: bool
    documents: bool
    rule42: bool
    scoreReview: bool
    requests: bool
    protest: bool

class RegattaMeta(BaseModel):
    id: int
    name: str

class RegattaStatusResponse(BaseModel):
    status: Literal["upcoming", "active", "finished"]
    now_utc: datetime
    start_utc: Optional[datetime] = None
    end_utc: Optional[datetime] = None
    windows: RegattaWindows
    regatta: Optional[RegattaMeta] = None

# ---------- HELPERS ----------

def _parse_date_utc(d: Optional[str]) -> Optional[datetime]:
    if not d:
        return None
    try:
        dt = datetime.strptime(d, "%Y-%m-%d")
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None

def _env_bool(key: str, default: bool = False) -> bool:
    val = os.getenv(key, "")
    if not val:
        return default
    return val.strip().lower() in ("1", "true", "yes", "y", "on")

def _env_csv_set(key: str) -> set[str]:
    raw = os.getenv(key, "")
    if not raw:
        return set()
    return {p.strip() for p in raw.split(",") if p.strip()}

def _compute_regatta_status(reg: models.Regatta) -> RegattaStatusResponse:
    now = datetime.now(timezone.utc)
    start = _parse_date_utc(reg.start_date)
    end = _parse_date_utc(reg.end_date)

    if not start or not end:
        status = "upcoming"
    else:
        end_inclusive = end + timedelta(days=1) - timedelta(seconds=1)
        if now < start:
            status = "upcoming"
        elif start <= now <= end_inclusive:
            status = "active"
        else:
            status = "finished"

    GRACE_SCORE_REVIEW_HOURS = 12
    GRACE_PROTEST_HOURS = 6

    is_active = (status == "active")

    can_rule42       = is_active
    can_requests     = is_active
    can_score_review = is_active or (end is not None and now <= end + timedelta(hours=GRACE_SCORE_REVIEW_HOURS))
    can_protest      = is_active or (end is not None and now <= end + timedelta(hours=GRACE_PROTEST_HOURS))
    can_entry_data   = True
    can_documents    = True

    if _env_bool("WINDOWS_FORCE_OPEN", False):
        can_entry_data = can_documents = can_rule42 = can_score_review = can_requests = can_protest = True
    else:
        force_set = _env_csv_set("WINDOWS_FORCE_ENABLE")
        if "entryData"   in force_set: can_entry_data = True
        if "documents"   in force_set: can_documents = True
        if "rule42"      in force_set: can_rule42 = True
        if "scoreReview" in force_set: can_score_review = True
        if "requests"    in force_set: can_requests = True
        if "protest"     in force_set: can_protest = True

    return RegattaStatusResponse(
        status=status,
        now_utc=now,
        start_utc=start,
        end_utc=end,
        windows=RegattaWindows(
            entryData=bool(can_entry_data),
            documents=bool(can_documents),
            rule42=bool(can_rule42),
            scoreReview=bool(can_score_review),
            requests=bool(can_requests),
            protest=bool(can_protest),
        ),
        regatta=RegattaMeta(id=reg.id, name=reg.name) if reg else None,
    )

# ---------- ENDPOINT ----------

@router.get("/{regatta_id}/status", response_model=RegattaStatusResponse)
def get_regatta_status(regatta_id: int, db: Session = Depends(get_db)):
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regata não encontrada")
    return _compute_regatta_status(reg)


# app/routes/regattas.py

@router.get("/{regatta_id}/classes", response_model=List[str])
def get_classes_for_regatta(regatta_id: int, db: Session = Depends(get_db)):
    """
    Lista de classes EXISTENTES nesta regata, normalizadas (trim),
    deduplicadas sem diferenciar maiúsc./minúsc.
    """
    # group by lower(trim(class_name)) e escolhe uma forma "bonita" (min)
    rows = (
        db.query(
            func.min(func.trim(models.Entry.class_name)).label("cls")
        )
        .filter(models.Entry.regatta_id == regatta_id)
        .filter(models.Entry.class_name.isnot(None))
        .group_by(func.lower(func.trim(models.Entry.class_name)))
        .order_by(func.min(func.trim(models.Entry.class_name)))
        .all()
    )
    return [r.cls for r in rows]
