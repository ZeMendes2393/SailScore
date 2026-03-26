"""Helpers para utilizadores (username único por organização)."""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app import models


def make_unique_username(db: Session, organization_id: int, base: str) -> str:
    """Gera username único dentro da organização (apenas [a-z0-9_])."""
    s = re.sub(r"[^a-z0-9_]", "", (base or "user").lower())[:48] or "u"
    candidate = s
    n = 0
    while (
        db.query(models.User.id)
        .filter(models.User.organization_id == organization_id, models.User.username == candidate)
        .first()
    ):
        n += 1
        candidate = f"{s}{n}"
    return candidate
