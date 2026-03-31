"""Validação partilhada entre criação e atualização de protestos."""
from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.models import Entry
from app.org_scope import assert_user_can_manage_org_id
from app.schemas import ProtestCreate
from app.jury_scope import assert_jury_regatta_access


def validate_protest_submission(
    db: Session,
    current_user: models.User,
    regatta_id: int,
    body: ProtestCreate,
) -> Optional[Entry]:
    """
    Devolve Entry do iniciador, ou None se for protesto de staff (admin/júri) só com texto livre
    (sem inscrição de iniciador).
    """
    entry_id = body.initiator_entry_id
    party_text = (body.initiator_party_text or "").strip()

    # Regatista: iniciador tem de ser inscrição
    if current_user.role == "regatista":
        if entry_id is None:
            raise HTTPException(status_code=422, detail="initiator_entry_id is required.")

    # --- Admin / platform_admin / júri: iniciador só texto (sem entry) ---
    if entry_id is None:
        if current_user.role not in ("admin", "platform_admin", "jury"):
            raise HTTPException(status_code=422, detail="initiator_entry_id is required.")
        if not party_text:
            raise HTTPException(
                status_code=422,
                detail="initiator_party_text is required when no initiator entry is selected.",
            )
        regatta = db.query(models.Regatta).filter_by(id=regatta_id).first()
        if not regatta:
            raise HTTPException(status_code=404, detail="Regatta not found")
        if current_user.role == "jury":
            assert_jury_regatta_access(db, current_user, regatta_id)
        else:
            assert_user_can_manage_org_id(current_user, regatta.organization_id)
        resp_ids: List[int] = [
            r.entry_id for r in body.respondents if getattr(r, "kind", "entry") == "entry" and r.entry_id
        ]
        if resp_ids:
            cnt_same = db.query(Entry).filter(Entry.id.in_(resp_ids), Entry.regatta_id == regatta_id).count()
            if cnt_same != len(resp_ids):
                raise HTTPException(status_code=422, detail="Some respondents do not belong to this regatta.")
        return None

    # --- Com inscrição de iniciador ---
    ini = db.query(Entry).filter(Entry.id == entry_id).first()
    if not ini or ini.regatta_id != regatta_id:
        raise HTTPException(status_code=403, detail="Initiator does not belong to this regatta.")

    if current_user.role == "jury":
        assert_jury_regatta_access(db, current_user, regatta_id)
    elif current_user.role in ("admin", "platform_admin"):
        regatta = db.query(models.Regatta).filter_by(id=regatta_id).first()
        if not regatta:
            raise HTTPException(status_code=404, detail="Regatta not found")
        assert_user_can_manage_org_id(current_user, regatta.organization_id)
    elif ini.user_id != current_user.id and (ini.email or "").strip().lower() != (
        current_user.email or ""
    ).strip().lower():
        raise HTTPException(status_code=403, detail="You are not the owner of this entry (initiator).")

    resp_ids = [
        r.entry_id for r in body.respondents if getattr(r, "kind", "entry") == "entry" and r.entry_id
    ]
    if resp_ids:
        cnt_same = db.query(Entry).filter(Entry.id.in_(resp_ids), Entry.regatta_id == regatta_id).count()
        if cnt_same != len(resp_ids):
            raise HTTPException(status_code=422, detail="Some respondents do not belong to this regatta.")

    return ini
