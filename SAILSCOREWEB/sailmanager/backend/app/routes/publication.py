# app/routes/publication.py — Publish (Public): per-class published_races_count (K)
from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from utils.auth_utils import get_current_user

router = APIRouter(prefix="/regattas", tags=["publication"])


def _get_regatta_timezone(reg) -> timezone:
    """Returns the timezone for published_at. Uses regatta.timezone if set, else UTC."""
    tz_str = (getattr(reg, "timezone", None) or "").strip()
    if not tz_str:
        return timezone.utc
    try:
        return ZoneInfo(tz_str)
    except Exception:
        return timezone.utc


class PublicationOut(BaseModel):
    regatta_id: int
    class_name: str
    published_races_count: int
    published_at: str | None = None


class PublicationIn(BaseModel):
    published_races_count: int = Field(ge=0, description="Number of races (1..K) to publish; 0 = none.")


def _get_publication_row(db: Session, regatta_id: int, class_name: str):
    return (
        db.query(models.RegattaClassPublication)
        .filter(
            models.RegattaClassPublication.regatta_id == regatta_id,
            models.RegattaClassPublication.class_name == class_name,
        )
        .first()
    )


def get_published_races_count(db: Session, regatta_id: int, class_name: str) -> int:
    row = _get_publication_row(db, regatta_id, class_name)
    return int(row.published_races_count) if row else 0


@router.get("/{regatta_id}/classes/{class_name}/publication", response_model=PublicationOut)
def get_publication(
    regatta_id: int,
    class_name: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regatta not found")
    row = _get_publication_row(db, regatta_id, class_name)
    k = int(row.published_races_count) if row else 0
    published_at_iso = None
    if row and getattr(row, "published_at", None):
        published_at_iso = row.published_at.isoformat() if hasattr(row.published_at, "isoformat") else str(row.published_at)
    return {
        "regatta_id": regatta_id,
        "class_name": class_name,
        "published_races_count": k,
        "published_at": published_at_iso,
    }


@router.put("/{regatta_id}/classes/{class_name}/publication", response_model=PublicationOut)
def set_publication(
    regatta_id: int,
    class_name: str,
    body: PublicationIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regatta not found")

    races = (
        db.query(models.Race)
        .filter(models.Race.regatta_id == regatta_id, models.Race.class_name == class_name)
        .order_by(models.Race.order_index.asc(), models.Race.id.asc())
        .all()
    )
    max_k = len(races)
    k = body.published_races_count
    if k > max_k:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish {k} races: class has only {max_k} race(s). Publish sequentially 1..K.",
        )

    tz = _get_regatta_timezone(reg)
    row = _get_publication_row(db, regatta_id, class_name)
    if row:
        row.published_races_count = k
        if k > 0:
            row.published_at = datetime.now(tz)
        else:
            row.published_at = None
    else:
        row = models.RegattaClassPublication(
            regatta_id=regatta_id,
            class_name=class_name,
            published_races_count=k,
            published_at=datetime.now(tz) if k > 0 else None,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    published_at_iso = None
    if getattr(row, "published_at", None) and hasattr(row.published_at, "isoformat"):
        published_at_iso = row.published_at.isoformat()
    return {
        "regatta_id": regatta_id,
        "class_name": class_name,
        "published_races_count": int(row.published_races_count),
        "published_at": published_at_iso,
    }
