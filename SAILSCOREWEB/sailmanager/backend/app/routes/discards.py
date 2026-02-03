# app/routes/discards.py
from __future__ import annotations

from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from utils.auth_utils import get_current_user

router = APIRouter(prefix="/regattas", tags=["discards"])


# -------------------------
# Pydantic
# -------------------------
class DiscardScheduleIn(BaseModel):
    # schedule[i-1] = nº descartes quando existem i races
    schedule: List[int] = Field(default_factory=list)
    is_active: bool = True
    label: Optional[str] = None


class DiscardScheduleOut(BaseModel):
    regatta_id: int
    class_name: str
    is_active: bool
    label: Optional[str]
    schedule: List[int]


# -------------------------
# Helpers
# -------------------------
def _require_admin(current_user: models.User):
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")


def _get_settings_row(db: Session, regatta_id: int, class_name: str):
    Model = getattr(models, "RegattaClassSettings", None)
    if Model is None:
        raise HTTPException(
            status_code=500,
            detail="Model RegattaClassSettings não existe. Confirma o nome no app/models.py.",
        )

    row = (
        db.query(Model)
        .filter(Model.regatta_id == regatta_id, Model.class_name == class_name)
        .first()
    )
    return Model, row


def _normalize_schedule(schedule: List[Any]) -> List[int]:
    out: List[int] = []
    for x in schedule or []:
        try:
            out.append(max(0, int(x)))
        except Exception:
            # ignora lixo
            pass
    return out


# -------------------------
# Endpoints
# -------------------------
@router.get("/{regatta_id}/classes/{class_name}/discard-schedule", response_model=DiscardScheduleOut)
def get_discard_schedule(
    regatta_id: int,
    class_name: str,
    db: Session = Depends(get_db),
):
    _, row = _get_settings_row(db, regatta_id, class_name)

    if not row:
        return {
            "regatta_id": regatta_id,
            "class_name": class_name,
            "is_active": False,
            "label": None,
            "schedule": [],
        }

    schedule = getattr(row, "discard_schedule", None) or []
    is_active = bool(getattr(row, "discard_schedule_active", True))
    label = getattr(row, "discard_schedule_label", None)

    return {
        "regatta_id": regatta_id,
        "class_name": class_name,
        "is_active": is_active,
        "label": label,
        "schedule": _normalize_schedule(schedule),
    }


@router.put("/{regatta_id}/classes/{class_name}/discard-schedule", response_model=DiscardScheduleOut)
def upsert_discard_schedule(
    regatta_id: int,
    class_name: str,
    body: DiscardScheduleIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_admin(current_user)

    Model, row = _get_settings_row(db, regatta_id, class_name)
    if not row:
        row = Model(regatta_id=regatta_id, class_name=class_name)
        db.add(row)
        db.flush()

    schedule = _normalize_schedule(body.schedule)

    # ✅ aqui NÃO forço monotonia (tu queres qualquer combinação)
    setattr(row, "discard_schedule", schedule)
    setattr(row, "discard_schedule_active", bool(body.is_active))
    setattr(row, "discard_schedule_label", body.label)

    db.commit()

    return {
        "regatta_id": regatta_id,
        "class_name": class_name,
        "is_active": bool(body.is_active),
        "label": body.label,
        "schedule": schedule,
    }


@router.delete("/{regatta_id}/classes/{class_name}/discard-schedule")
def delete_discard_schedule(
    regatta_id: int,
    class_name: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_admin(current_user)

    _, row = _get_settings_row(db, regatta_id, class_name)
    if not row:
        return {"ok": True}

    setattr(row, "discard_schedule", None)
    setattr(row, "discard_schedule_active", True)
    setattr(row, "discard_schedule_label", None)

    db.commit()
    return {"ok": True}
