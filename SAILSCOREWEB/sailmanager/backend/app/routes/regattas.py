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

router = APIRouter(prefix="/regattas", tags=["regattas"])

# ---------------- Regattas CRUD ----------------

@router.get("/", response_model=List[schemas.RegattaRead])
def list_regattas(db: Session = Depends(get_db)):
    return db.query(models.Regatta).all()

@router.post("/", response_model=schemas.RegattaRead)
def create_regatta(
    regatta: schemas.RegattaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    new_regatta = models.Regatta(**regatta.model_dump())
    db.add(new_regatta)
    db.commit()
    db.refresh(new_regatta)
    return new_regatta

@router.get("/{regatta_id}", response_model=schemas.RegattaRead)
def get_regatta(regatta_id: int, db: Session = Depends(get_db)):
    r = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Regatta not found")
    return r

@router.patch("/{regatta_id}", response_model=schemas.RegattaRead)
def update_regatta(
    regatta_id: int,
    body: schemas.RegattaUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regata não encontrada")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(reg, field, value)

    db.commit()
    db.refresh(reg)
    return reg

@router.delete("/{regatta_id}", status_code=204)
def delete_regatta(
    regatta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regata não encontrada")

    db.delete(reg)
    db.commit()
    return

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

@router.get("/{regatta_id}/classes", response_model=List[str])
def get_classes_for_regatta(regatta_id: int, db: Session = Depends(get_db)):
    # 1) Preferir as classes configuradas (RegattaClass) — funciona para regatas novas
    try:
        rc_rows = (
            db.query(func.min(func.trim(models.RegattaClass.class_name)).label("cls"))
              .filter(models.RegattaClass.regatta_id == regatta_id)
              .filter(models.RegattaClass.class_name.isnot(None))
              .group_by(func.lower(func.trim(models.RegattaClass.class_name)))
              .order_by(func.min(func.trim(models.RegattaClass.class_name)))
              .all()
        )
        rc_classes = [r.cls for r in rc_rows if r and r.cls]
        if rc_classes:
            return rc_classes
    except Exception:
        # se por algum motivo a tabela/model não existir, cai para o fallback
        pass

    # 2) Fallback legacy: deduzir a partir das entries — mantém compatibilidade com regatas antigas
    rows = (
        db.query(func.min(func.trim(models.Entry.class_name)).label("cls"))
          .filter(models.Entry.regatta_id == regatta_id)
          .filter(models.Entry.class_name.isnot(None))
          .group_by(func.lower(func.trim(models.Entry.class_name)))
          .order_by(func.min(func.trim(models.Entry.class_name)))
          .all()
    )
    return [r.cls for r in rows if r and r.cls]

# --------- SUBSTITUIR classes (em lote) ---------
@router.put("/{regatta_id}/classes", response_model=List[schemas.RegattaClassRead])
def replace_regatta_classes(
    regatta_id: int,
    body: schemas.RegattaClassesReplace,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regata não encontrada")

    normalized = []
    seen = set()
    for raw in body.classes or []:
        s = (raw or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(s)

    existing = db.query(models.RegattaClass).filter_by(regatta_id=regatta_id).all()
    existing_by_key = {rc.class_name.strip().lower(): rc for rc in existing}

    target_keys = {c.lower() for c in normalized}
    to_delete = [rc for k, rc in existing_by_key.items() if k not in target_keys]
    to_add = [c for c in normalized if c.lower() not in existing_by_key]

    for rc in to_delete:
        db.delete(rc)
    for c in to_add:
        db.add(models.RegattaClass(regatta_id=regatta_id, class_name=c))

    db.commit()

    return (
        db.query(models.RegattaClass)
          .filter_by(regatta_id=regatta_id)
          .order_by(models.RegattaClass.class_name)
          .all()
    )
