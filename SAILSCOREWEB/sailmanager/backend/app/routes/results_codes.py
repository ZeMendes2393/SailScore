# app/routes/results_codes.py
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.scoring_codes import (
    N_PLUS_ONE_DISCARDABLE,
    N_PLUS_ONE_NOT_DISCARDABLE,
    ADJUSTABLE_CODES,
    is_discardable,
)

router = APIRouter()

@router.get("/regattas/{regatta_id}/classes/{class_name}/scoring-code-presets")
def scoring_code_presets(
    regatta_id: int,
    class_name: str,
    db: Session = Depends(get_db),
):
    # (regatta_id/class_name estão no path para ser fácil de usar no frontend,
    # mas este endpoint devolve só os "presets".)
    out = []

    for c in sorted(N_PLUS_ONE_DISCARDABLE):
        out.append({"code": c, "mode": "n_plus_one", "discardable": True, "requires_value": False})

    for c in sorted(N_PLUS_ONE_NOT_DISCARDABLE):
        out.append({"code": c, "mode": "n_plus_one", "discardable": False, "requires_value": False})

    for c in sorted(ADJUSTABLE_CODES):
        out.append({"code": c, "mode": "adjustable", "discardable": is_discardable(c), "requires_value": True})

    return out
