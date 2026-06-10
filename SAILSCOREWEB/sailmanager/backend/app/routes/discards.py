# app/routes/discards.py
from __future__ import annotations

from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.org_scope import assert_staff_regatta_access, assert_user_can_manage_org_id
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
    if getattr(current_user, "role", None) not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Acesso negado")


def _get_settings_row(db: Session, regatta_id: int, class_name: str):
    Model = getattr(models, "RegattaClassSettings", None)
    if Model is None:
        raise HTTPException(
            status_code=500,
            detail="RegattaClassSettings model is missing. Check the model name in app/models.py.",
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


def _default_schedule_from_count_threshold(
    discard_count: int,
    discard_threshold: int,
    *,
    length: int = 13,
) -> List[int]:
    """
    Build a schedule equivalent to legacy (count + threshold) behavior:
    - if n_races >= threshold => discard_count
    - else => 0
    """
    d = max(0, int(discard_count or 0))
    th = int(discard_threshold or 0)
    if length <= 0:
        return []
    if d <= 0:
        return [0 for _ in range(length)]
    if th <= 0:
        return [d for _ in range(length)]
    return [d if (i + 1) >= th else 0 for i in range(length)]


# -------------------------
# Endpoints
# -------------------------
@router.get("/{regatta_id}/classes/{class_name}/discard-schedule", response_model=DiscardScheduleOut)
def get_discard_schedule(
    regatta_id: int,
    class_name: str,
    db: Session = Depends(get_db),
):
    regatta = db.query(models.Regatta).filter_by(id=regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")

    _, row = _get_settings_row(db, regatta_id, class_name)

    reg_default_d = int(getattr(regatta, "discard_count", 0) or 0)
    reg_default_th = int(getattr(regatta, "discard_threshold", 0) or 0)
    d_eff = reg_default_d
    th_eff = reg_default_th
    if row is not None:
        if getattr(row, "discard_count", None) is not None:
            d_eff = int(row.discard_count)
        if getattr(row, "discard_threshold", None) is not None:
            th_eff = int(row.discard_threshold)

    raw_schedule = getattr(row, "discard_schedule", None) if row is not None else None
    parsed_schedule = _normalize_schedule(raw_schedule or [])
    is_active = bool(getattr(row, "discard_schedule_active", True)) if row is not None else False
    label = getattr(row, "discard_schedule_label", None) if row is not None else None
    effective_schedule = (
        parsed_schedule
        if (is_active and len(parsed_schedule) > 0)
        else _default_schedule_from_count_threshold(d_eff, th_eff)
    )

    return {
        "regatta_id": regatta_id,
        "class_name": class_name,
        "is_active": is_active,
        "label": label,
        "schedule": effective_schedule,
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

    regatta = db.query(models.Regatta).filter_by(id=regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    if getattr(current_user, "role", None) in ("admin", "platform_admin"):
        assert_user_can_manage_org_id(current_user, regatta.organization_id)
    else:
        assert_staff_regatta_access(db, current_user, regatta_id)

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

    regatta = db.query(models.Regatta).filter_by(id=regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    if getattr(current_user, "role", None) in ("admin", "platform_admin"):
        assert_user_can_manage_org_id(current_user, regatta.organization_id)
    else:
        assert_staff_regatta_access(db, current_user, regatta_id)

    _, row = _get_settings_row(db, regatta_id, class_name)
    if not row:
        return {"ok": True}

    setattr(row, "discard_schedule", None)
    setattr(row, "discard_schedule_active", True)
    setattr(row, "discard_schedule_label", None)

    db.commit()
    return {"ok": True}
