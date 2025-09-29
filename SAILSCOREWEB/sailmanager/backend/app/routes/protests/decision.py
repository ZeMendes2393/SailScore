from __future__ import annotations

from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
import os, traceback
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.models import Protest, Hearing, ProtestAttachment
from app.database import get_db
from utils.auth_utils import get_current_user, verify_role
from .helpers import PUBLIC_BASE_URL, tiny_valid_pdf_bytes, normalize_public_url
from app.services.pdf.decision_pdf import generate_decision_pdf

router = APIRouter()

# -------------------------
# GET template
# -------------------------
@router.get("/{protest_id}/decision/template", dependencies=[Depends(verify_role(["admin"]))])
def decision_template(regatta_id: int, protest_id: int, db: Session = Depends(get_db)):
    p = (
        db.query(models.Protest)
        .filter(models.Protest.id == protest_id, models.Protest.regatta_id == regatta_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Protest not found")

    h = db.query(models.Hearing).filter(models.Hearing.protest_id == protest_id).first()
    case_number = getattr(h, "case_number", None)

    snap = getattr(p, "submitted_snapshot_json", {}) or {}
    initiator = snap.get("initiator") or {}
    respondents = snap.get("respondents") or []
    protestee = respondents[0] if respondents else None

    # Nome do evento com fallback à Regatta
    event_title = snap.get("regatta_name")
    venue = snap.get("venue")
    if not event_title:
        try:
            reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
            if reg:
                event_title = getattr(reg, "name", None)
                venue = getattr(reg, "venue", None) or getattr(reg, "location", None)
        except Exception:
            pass
    event_title = event_title or f"Regatta {regatta_id}"

    tpl = {
        "event": event_title,
        "venue": venue,
        "case_number": case_number,
        "race_number": getattr(p, "race_number", None),
        "class_name": initiator.get("class_name"),
        "protestor": initiator,
        "protestee": protestee,
        "witnesses": [],

        # Summary defaults
        "type_of_hearing": (p.type or "protest").upper(),
        "hearing_status": getattr(h, "status", None) or "OPEN",
        "valid": None,
        "date_of_race": getattr(p, "race_date", None),
        "received_time": None,
        "class_fleet": initiator.get("class_name"),

        # Texto/itens
        "case_summary": "",
        "procedural_matters": "",
        "facts_found": "",
        "conclusions_and_rules": "",
        "decision_text": "",
        "short_decision": "",

        # Painel
        "panel_chair": "",
        "panel_members": [],

        # Hearing meta
        "hearing_location": getattr(h, "room", None) if h else None,
        "hearing_datetime": None,
    }
    return {"template": tpl}


# -------------------------
# POST save decision
# -------------------------
@router.post("/{protest_id}/decision", dependencies=[Depends(verify_role(["admin"]))])
def save_decision(
    regatta_id: int,
    protest_id: int,
    body: schemas.ProtestDecisionIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    p = (
        db.query(Protest)
        .filter(Protest.id == protest_id, Protest.regatta_id == regatta_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Protest not found")

    h = db.query(Hearing).filter(Hearing.protest_id == protest_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hearing not found")

    # Validação mínima
    if not (body.facts_found and body.conclusions_and_rules and (body.short_decision or body.decision_text)):
        raise HTTPException(
            status_code=422,
            detail="facts_found, conclusions_and_rules e short_decision/decision_text são obrigatórios.",
        )

    # Snapshot vindo do body
    snapshot = body.model_dump(exclude_none=True)
    now_utc = datetime.utcnow()

    # Guardar no Hearing
    h.decision_snapshot_json = snapshot
    h.decision_at = now_utc
    h.panel_chair = body.panel_chair
    h.panel_members = body.panel_members or []
    h.status = "CLOSED"
    db.add(h)

    # Espelhar no Protest
    p.decision_json = snapshot
    p.status = "decided"
    p.decided_at = now_utc
    p.decided_by_user_id = getattr(current_user, "id", None)
    db.add(p)
    db.commit()
    db.refresh(p)
    db.refresh(h)

    # -------- PDF (gerador “bonito”) --------
    submitted = (getattr(p, "submitted_snapshot_json", {}) or {})
    snap_ext = dict(snapshot)

    # Nome do evento com fallback seguro
    event_title = submitted.get("regatta_name")
    venue = submitted.get("venue")
    if not event_title:
        try:
            reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
            if reg:
                event_title = getattr(reg, "name", None)
                venue = getattr(reg, "venue", None) or getattr(reg, "location", None)
        except Exception:
            pass
    event_title = event_title or f"Regatta {regatta_id}"

    # cabeçalho do PDF
    snap_ext.setdefault("event", event_title)
    snap_ext.setdefault("case_number", getattr(h, "case_number", None))

    public_url: Optional[str] = None
    file_path: Optional[Path] = None
    wrote_ok = False

    try:
        pdf_path, public_url = generate_decision_pdf(
            regatta_id=regatta_id,
            protest_id=protest_id,
            snapshot=snap_ext,
            regatta_title=event_title,
            venue=venue,
        )
        file_path = pdf_path
        if file_path and file_path.exists() and file_path.stat().st_size > 0:
            wrote_ok = True
        public_url = normalize_public_url(public_url)
    except Exception as e:
        # LOG COMPLETO para enxergar a causa real
        print("[decision_pdf] generate_decision_pdf ERROR:")
        print(traceback.format_exc())

    # Fallback (PDF mínimo)
    if not wrote_ok:
        uploads_dir = Path("uploads") / "protests" / str(regatta_id)
        uploads_dir.mkdir(parents=True, exist_ok=True)
        file_path = uploads_dir / f"decision_{protest_id}.pdf"
        file_path.write_bytes(
            tiny_valid_pdf_bytes("Hearing Decision", f"Protest ID: {protest_id}")
        )
        public_url = f"{PUBLIC_BASE_URL}/uploads/protests/{regatta_id}/decision_{protest_id}.pdf"
        public_url = normalize_public_url(public_url)

    # Atualizar URLs
    p.decision_pdf_url = public_url
    h.decision_pdf_url = public_url
    db.add(p)
    db.add(h)

    # Attachment
    filename = os.path.basename(urlparse(public_url).path) if public_url else f"decision_{protest_id}.pdf"
    size = file_path.stat().st_size if file_path and file_path.exists() else 0
    db.add(
        ProtestAttachment(
            protest_id=protest_id,
            kind="decision_pdf",
            filename=filename,
            content_type="application/pdf",
            size=size,
            url=public_url,
            uploaded_by_user_id=getattr(current_user, "id", None),
        )
    )
    db.commit()

    return {
        "ok": True,
        "protest_id": p.id,
        "hearing_id": h.id,
        "status_after": p.status,
        "decision_pdf_url": p.decision_pdf_url,
        "decision_snapshot": snapshot,
    }
