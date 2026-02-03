# app/routes/results_utils.py
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


def _norm(code: str | None) -> str | None:
    c = (code or "").strip().upper()
    return c or None


def _norm_sn(sn: str | None) -> str | None:
    s = (sn or "").strip()
    return s or None


def _points_for(mapping: dict, code: str | None, pos: int) -> float:
    """
    Mantido por compatibilidade (alguns endpoints ainda podiam chamar).
    Mas a partir de agora preferimos o resolver central (services/scoring_codes.py).
    """
    if not code:
        return float(pos)
    c = (code or "").strip().upper()
    try:
        return float(mapping.get(c, pos))
    except Exception:
        return float(pos)


class ResultUpsert(BaseModel):
    regatta_id: int
    sail_number: str
    boat_name: str | None = None
    helm_name: str | None = None
    position: int = Field(ge=1)
    points: float = Field(ge=0)


class SingleResultCreate(BaseModel):
    regatta_id: int
    sail_number: str
    boat_name: str | None = None
    helm_name: str | None = None
    desired_position: int = Field(ge=1)
    points: float | None = Field(default=None, ge=0)
    code: str | None = None


class ReorderBody(BaseModel):
    ordered_ids: List[int]


class PositionPatch(BaseModel):
    new_position: int = Field(ge=1)


class CodePatch(BaseModel):
    """
    ✅ Agora aceita 'points' opcional
      - obrigatório para RDG/SCP/ZPF/DPI
      - ignorado para códigos N+1 e códigos fixos do mapping
    """
    code: str | None = None
    points: float | None = Field(default=None, ge=0)
