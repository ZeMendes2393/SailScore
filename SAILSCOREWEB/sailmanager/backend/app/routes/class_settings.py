# app/routes/class_settings.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Body, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from utils.auth_utils import get_current_user

router = APIRouter(tags=["Class Settings"])

# ---- Pydantic bodies/out ----
class ClassSettingsUpdate(BaseModel):
    discard_count: Optional[int] = None
    discard_threshold: Optional[int] = None
    scoring_codes: Optional[Dict[str, float]] = None  # ex.: {"DNF": 35, "UFD": 42}

class ClassSettingsOut(BaseModel):
    class_name: str
    overrides: Dict[str, Any]
    resolved: Dict[str, Any]

# ---- helpers ----
def _ensure_regatta(db: Session, regatta_id: int) -> models.Regatta:
    regatta = db.query(models.Regatta).filter_by(id=regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regata não encontrada")
    return regatta

def _get_settings_row(db: Session, regatta_id: int, class_name: str) -> Optional[models.RegattaClassSettings]:
    return (
        db.query(models.RegattaClassSettings)
        .filter(
            models.RegattaClassSettings.regatta_id == regatta_id,
            models.RegattaClassSettings.class_name == class_name,
        )
        .first()
    )

def _resolved_dict(
    regatta: models.Regatta,
    settings: Optional[models.RegattaClassSettings],
) -> Dict[str, Any]:
    # herda dos globais; overrides têm prioridade
    regatta_codes = regatta.scoring_codes or {}
    override_codes = (settings.scoring_codes if settings else {}) or {}

    # merge de códigos (overrides > globais)
    merged_codes = {**regatta_codes, **override_codes}

    return {
        "discard_count": (
            settings.discard_count if (settings and settings.discard_count is not None)
            else (regatta.discard_count or 0)
        ),
        "discard_threshold": (
            settings.discard_threshold if (settings and settings.discard_threshold is not None)
            else (regatta.discard_threshold or 0)
        ),
        "scoring_codes": merged_codes,
    }

def _overrides_dict(settings: Optional[models.RegattaClassSettings]) -> Dict[str, Any]:
    if not settings:
        return {
            "discard_count": None,
            "discard_threshold": None,
            "scoring_codes": {},
        }
    return {
        "discard_count": settings.discard_count,
        "discard_threshold": settings.discard_threshold,
        "scoring_codes": settings.scoring_codes or {},
    }

# ---- routes ----

@router.get("/regattas/{regatta_id}/class-settings/{class_name}", response_model=ClassSettingsOut)
def get_class_settings(
    regatta_id: int,
    class_name: str,
    db: Session = Depends(get_db),
    # leitura pode ser aberta se quiseres; se precisares, adiciona:
    # current_user: models.User = Depends(get_current_user),
):
    regatta = _ensure_regatta(db, regatta_id)
    row = _get_settings_row(db, regatta_id, class_name)
    return ClassSettingsOut(
        class_name=class_name,
        overrides=_overrides_dict(row),
        resolved=_resolved_dict(regatta, row),
    )

@router.patch("/regattas/{regatta_id}/class-settings/{class_name}", response_model=ClassSettingsOut, status_code=status.HTTP_200_OK)
def upsert_class_settings(
    regatta_id: int,
    class_name: str,
    body: ClassSettingsUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # só admin pode alterar
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    regatta = _ensure_regatta(db, regatta_id)
    row = _get_settings_row(db, regatta_id, class_name)

    if row is None:
        # criar overrides novos
        row = models.RegattaClassSettings(
            regatta_id=regatta_id,
            class_name=class_name,
            discard_count=body.discard_count,
            discard_threshold=body.discard_threshold,
            scoring_codes=(body.scoring_codes or {}),
        )
        db.add(row)
    else:
        # atualizar apenas campos fornecidos
        if body.discard_count is not None:
            row.discard_count = body.discard_count
        if body.discard_threshold is not None:
            row.discard_threshold = body.discard_threshold
        if body.scoring_codes is not None:
            row.scoring_codes = body.scoring_codes

    db.commit()
    db.refresh(row)

    return ClassSettingsOut(
        class_name=class_name,
        overrides=_overrides_dict(row),
        resolved=_resolved_dict(regatta, row),
    )
