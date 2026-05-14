"""Leitura e atualização de protestos (admin / júri)."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Protest, ProtestParty
from app.schemas import ProtestCreate
from utils.auth_utils import get_current_user
from utils.guards import ensure_regatta_scope

from .validation import validate_protest_submission
from .submission import apply_submitted_snapshot_and_pdf

router = APIRouter()


def _require_admin_or_jury(user) -> None:
    if user.role not in ("admin", "platform_admin", "jury"):
        raise HTTPException(
            status_code=403,
            detail="Only an organization administrator or jury may view or edit here.",
        )


@router.get("/{protest_id}/for-edit")
def get_protest_for_edit(
    regatta_id: int,
    protest_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(ensure_regatta_scope),
):
    _require_admin_or_jury(current_user)

    p = (
        db.query(Protest)
        .filter(Protest.id == protest_id, Protest.regatta_id == regatta_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Protest not found")

    respondents_out = []
    for party in p.parties:
        respondents_out.append(
            {
                "kind": party.kind or "entry",
                "entry_id": party.entry_id,
                "free_text": party.free_text,
                "represented_by": party.represented_by,
            }
        )

    return {
        "id": p.id,
        "type": p.type,
        "race_date": p.race_date,
        "race_number": p.race_number,
        "group_name": p.group_name,
        "initiator_entry_id": p.initiator_entry_id,
        "initiator_party_text": getattr(p, "initiator_party_text", None),
        "initiator_represented_by": p.initiator_represented_by,
        "respondents": respondents_out,
        "incident": {
            "when_where": p.incident_when_where,
            "description": p.incident_description,
            "rules_applied": p.rules_alleged,
        },
    }


@router.patch("/{protest_id}")
def update_protest(
    regatta_id: int,
    protest_id: int,
    body: ProtestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(ensure_regatta_scope),
):
    _require_admin_or_jury(current_user)

    p = (
        db.query(Protest)
        .filter(Protest.id == protest_id, Protest.regatta_id == regatta_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Protest not found")

    ini = validate_protest_submission(db, current_user, regatta_id, body)

    incident = getattr(body, "incident", None)
    p.type = body.type
    p.race_date = body.race_date
    p.race_number = body.race_number
    p.group_name = body.group_name
    p.initiator_entry_id = body.initiator_entry_id
    pt = (body.initiator_party_text or "").strip() or None
    p.initiator_party_text = pt if body.initiator_entry_id is None else None
    p.initiator_represented_by = body.initiator_represented_by
    p.updated_at = datetime.utcnow()
    p.incident_when_where = (
        incident.when_where if incident else getattr(body, "incident_when_where", None)
    )
    p.incident_description = (
        incident.description if incident else getattr(body, "incident_description", None)
    )
    p.rules_alleged = (
        incident.rules_applied if incident else getattr(body, "rules_alleged", None)
    )

    db.query(ProtestParty).filter(ProtestParty.protest_id == p.id).delete(
        synchronize_session=False
    )

    for r in body.respondents:
        db.add(
            ProtestParty(
                protest_id=p.id,
                kind=getattr(r, "kind", "entry") or "entry",
                entry_id=r.entry_id if getattr(r, "kind", "entry") == "entry" else None,
                free_text=r.free_text if getattr(r, "kind", "entry") != "entry" else None,
                represented_by=getattr(r, "represented_by", None),
            )
        )

    db.commit()
    db.refresh(p)

    apply_submitted_snapshot_and_pdf(
        db,
        p,
        body,
        ini,
        regatta_id,
        current_user.id,
        replace_submitted_pdfs=True,
    )

    return {"id": p.id, "short_code": f"P-{p.id}"}
