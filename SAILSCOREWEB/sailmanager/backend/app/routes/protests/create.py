from __future__ import annotations

from datetime import datetime
import os
from typing import List

from fastapi import APIRouter, Depends, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Protest, ProtestParty, Entry
from app import models
from app.schemas import ProtestCreate
from utils.auth_utils import get_current_user
from utils.guards import ensure_regatta_scope
from app.services.email import send_email

from .validation import validate_protest_submission
from .submission import apply_submitted_snapshot_and_pdf

router = APIRouter()

# Temporary feature flag: disable protest email notifications while not needed.
# Keep the code path intact so it can be re-enabled by flipping this flag.
PROTEST_EMAIL_ENABLED = os.getenv("SAILSCORE_PROTEST_EMAIL_ENABLED", "false").lower() in {
    "1",
    "true",
    "yes",
    "y",
    "on",
}


@router.post("/", status_code=status.HTTP_201_CREATED)  # path vazio (correto)
def create_protest(
    regatta_id: int,
    body: ProtestCreate,
    background: BackgroundTasks,                     # <-- sem Optional e ANTES dos Depends
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(ensure_regatta_scope),
):
    ini = validate_protest_submission(db, current_user, regatta_id, body)

    # --- cria protesto ---
    incident = getattr(body, "incident", None)
    party_txt = (body.initiator_party_text or "").strip() or None
    p = Protest(
        regatta_id=regatta_id,
        type=body.type,
        race_date=body.race_date,
        race_number=body.race_number,
        group_name=body.group_name,
        initiator_entry_id=body.initiator_entry_id,
        initiator_party_text=party_txt if body.initiator_entry_id is None else None,
        initiator_represented_by=body.initiator_represented_by,
        status="submitted",
        received_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        incident_when_where=(incident.when_where if incident else getattr(body, "incident_when_where", None)),
        incident_description=(incident.description if incident else getattr(body, "incident_description", None)),
        rules_alleged=(incident.rules_applied if incident else getattr(body, "rules_alleged", None)),
    )
    db.add(p)
    db.flush()  # p.id já existe

    for r in body.respondents:
        db.add(ProtestParty(
            protest_id=p.id,
            kind=getattr(r, "kind", "entry") or "entry",
            entry_id=r.entry_id if getattr(r, "kind", "entry") == "entry" else None,
            free_text=r.free_text if getattr(r, "kind", "entry") != "entry" else None,
            represented_by=getattr(r, "represented_by", None),
        ))

    db.commit()
    db.refresh(p)

    apply_submitted_snapshot_and_pdf(
        db,
        p,
        body,
        ini,
        regatta_id,
        current_user.id,
        replace_submitted_pdfs=False,
    )

    # -------- hearing auto --------
    hearing_created = False
    try:
        exists_h = db.query(models.Hearing.id).filter(models.Hearing.protest_id == p.id).first()
        if not exists_h:
            last_case = (
                db.query(models.Hearing.case_number)
                .filter(models.Hearing.regatta_id == regatta_id)
                .order_by(models.Hearing.case_number.desc())
                .first()
            )
            next_case = (last_case[0] if last_case and last_case[0] else 0) + 1

            h = models.Hearing(
                regatta_id=regatta_id,
                protest_id=p.id,
                case_number=next_case,
                status="OPEN",
            )
            db.add(h)
            db.commit()
            hearing_created = True
    except Exception as err:
        db.rollback()
        print(f"[HEARING_AUTOCREATE][regatta={regatta_id} protest={p.id}] falhou: {err}")

    resp_ids: List[int] = [
        r.entry_id for r in body.respondents if getattr(r, "kind", "entry") == "entry" and r.entry_id
    ]

    # -------- emails (best-effort) --------
    try:
        if PROTEST_EMAIL_ENABLED and resp_ids and background:
            entries = db.query(Entry).filter(Entry.id.in_(resp_ids)).all()
            to_emails = sorted({(e.email or "").strip().lower() for e in entries if e.email})
            if to_emails:
                subject = f"[SailScore] Foste protestado (P-{p.id})"
                text = (
                    "Olá,\n\n"
                    "Foste indicado como parte num protesto.\n\n"
                    f"Protesto: P-{p.id}\n"
                    f"Tipo: {p.type}\n"
                    f"Regata ID: {p.regatta_id}\n"
                    f"Prova/Race: {p.race_number or '—'} | Data: {p.race_date or '—'}\n"
                    f"Grupo: {p.group_name or '—'}\n\n"
                    "Inicia sessão para ver detalhes e acompanhar o estado.\n\n"
                    "— SailScore"
                )
                for to in to_emails:
                    background.add_task(send_email, to, subject, None, text)
    except Exception as mail_err:
        print(f"[PROTEST_EMAIL][protest={p.id}] falhou: {mail_err}")

    return {"id": p.id, "short_code": f"P-{p.id}", "hearing_created": hearing_created}
