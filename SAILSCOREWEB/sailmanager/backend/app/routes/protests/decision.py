from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, load_only

from app.database import get_db
from app import models, schemas
from app.models import Protest, Hearing, ProtestAttachment
from utils.auth_utils import get_current_user, verify_role
from .helpers import PUBLIC_BASE_URL, tiny_valid_pdf_bytes, normalize_public_url
from app.services.pdf import generate_decision_pdf  # gerador central

router = APIRouter()


def _party_label(d: object, role: str) -> str:
    """Aceita None/str/dict. Só usa .get se for dict."""
    if not isinstance(d, dict):
        return f"{role}: —"
    sail = (d.get("sail_no") or "").strip()
    boat = (d.get("boat_name") or "").strip()
    cls  = (d.get("class_name") or "").strip()
    parts: List[str] = [x for x in (sail, boat, cls) if x]
    body = " ".join(parts) if parts else "—"
    return f"{role}: {body}"


@router.get("/{protest_id}/decision/template", dependencies=[Depends(verify_role(["admin"]))])
def decision_template(regatta_id: int, protest_id: int, db: Session = Depends(get_db)):
    # Protest
    p = (
        db.query(models.Protest)
        .filter(models.Protest.id == protest_id, models.Protest.regatta_id == regatta_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Protest not found")

    # Hearing pode não existir. Limitar colunas a EXISTENTES.
    h = (
        db.query(models.Hearing)
        .options(load_only(models.Hearing.id, models.Hearing.protest_id, models.Hearing.case_number, models.Hearing.status))
        .filter(models.Hearing.protest_id == protest_id)
        .first()
    )
    case_number = getattr(h, "case_number", None)

    # Snapshot robusto
    snap = getattr(p, "submitted_snapshot_json", {}) or {}
    if not isinstance(snap, dict):
        snap = {}

    initiator = snap.get("initiator") or {}
    if not isinstance(initiator, dict):
        initiator = {}

    respondents = snap.get("respondents") or []
    if not isinstance(respondents, list):
        respondents = []
    protestee = next((r for r in respondents if isinstance(r, dict)), None)

    # Evento + venue (fallback via Regatta)
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

    # received_time seguro
    rec_at = getattr(p, "received_at", None)
    received_time = None
    try:
        if isinstance(rec_at, datetime):
            received_time = rec_at.replace(microsecond=0).isoformat() + "Z"
    except Exception:
        received_time = None

    # Template
    tpl = {
        "regatta_name": event_title,
        "venue": venue,
        "case_number": case_number,
        "race_number": getattr(p, "race_number", None),

        "type": (getattr(p, "type", "") or "protest").upper(),
        "hearing_status": (getattr(h, "status", None) or "OPEN") if h else "OPEN",
        "valid": None,
        "date_of_race": getattr(p, "race_date", None),
        "received_time": received_time,
        "class_fleet": initiator.get("class_name"),

        "parties": [
            _party_label(initiator, "Protestor"),
            _party_label(protestee, "Protestee"),
        ],
        "witnesses": [],

        "case_summary": "",
        "procedural_matters": "",
        "facts_found": "",
        "conclusions_and_rules": "",
        "decision_text": "",
        "short_decision": "",

        "panel_chair": "",
        "panel_members": [],

        "decision_date": None,
        "decision_time": None,
    }
    return {"template": tpl}


@router.post("/{protest_id}/decision", dependencies=[Depends(verify_role(["admin"]))])
def save_decision(
    regatta_id: int,
    protest_id: int,
    body: schemas.ProtestDecisionIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Protest
    p = (
        db.query(Protest)
        .filter(Protest.id == protest_id, Protest.regatta_id == regatta_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Protest not found")

    # Hearing (limitar colunas a EXISTENTES)
    h = (
        db.query(Hearing)
        .options(load_only(Hearing.id, Hearing.case_number, Hearing.status, Hearing.protest_id, Hearing.regatta_id))
        .filter(Hearing.protest_id == protest_id)
        .first()
    )
    if not h:
        raise HTTPException(status_code=404, detail="Hearing not found")

    # Regras mínimas
    if not (body.facts_found and body.conclusions_and_rules and (body.short_decision or body.decision_text)):
        raise HTTPException(
            status_code=422,
            detail="facts_found, conclusions_and_rules e short_decision/decision_text são obrigatórios.",
        )

    # Snapshot enriquecido (robusto)
    submitted = getattr(p, "submitted_snapshot_json", {}) or {}
    if not isinstance(submitted, dict):
        submitted = {}

    initiator = submitted.get("initiator") or {}
    if not isinstance(initiator, dict):
        initiator = {}

    respondents = submitted.get("respondents") or []
    if not isinstance(respondents, list):
        respondents = []
    protestee = next((r for r in respondents if isinstance(r, dict)), None)

    # Evento + venue (fallback)
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

    now = datetime.utcnow()
    received_time = None
    try:
        ra = getattr(p, "received_at", None)
        if isinstance(ra, datetime):
            received_time = ra.replace(microsecond=0).isoformat() + "Z"
    except Exception:
        received_time = None

    # Documento para o PDF
    decision_doc = {
        "regatta_name": event_title,
        "venue": venue,
        "case_number": getattr(h, "case_number", None),
        "race_number": getattr(p, "race_number", None),

        "type": (p.type or "protest").upper(),
        "hearing_status": getattr(h, "status", None) or "OPEN",
        "valid": getattr(body, "valid", None),

        "date_of_race": getattr(p, "race_date", None),
        "received_time": received_time,
        "class_fleet": initiator.get("class_name"),

        "parties": [
            _party_label(initiator, "Protestor"),
            _party_label(protestee, "Protestee"),
        ],
        "witnesses": body.witnesses or [],

        "case_summary": body.case_summary or "",
        "procedural_matters": body.procedural_matters or "",
        "facts_found": body.facts_found or "",
        "conclusions_and_rules": body.conclusions_and_rules or "",
        "decision_text": body.decision_text or "",
        "short_decision": body.short_decision or "",

        "panel_chair": body.panel_chair or "",
        "panel_members": body.panel_members or [],

        "decision_date": now.date().isoformat(),
        "decision_time": now.strftime("%H:%M"),
    }

    # Atualizar estado (apenas colunas que EXISTEM)
    try:
        h.status = "CLOSED"  # esta existe
    except Exception:
        pass
    try:
        p.decision_json = body.model_dump(exclude_none=True)
        p.status = "decided"
        p.decided_at = now
        p.decided_by_user_id = getattr(current_user, "id", None)
    except Exception:
        pass

    db.add(h)
    db.add(p)
    db.commit()
    db.refresh(p)
    db.refresh(h)

    # PDF via serviço (com fallback)
    public_url: Optional[str] = None
    file_path: Optional[Path] = None
    wrote_ok = False

    try:
        disk_path, public_url = generate_decision_pdf(
            regatta_id=regatta_id,
            protest_id=protest_id,
            decision=decision_doc,
        )
        file_path = Path(disk_path)
        if file_path.exists() and file_path.stat().st_size > 0:
            wrote_ok = True
        public_url = normalize_public_url(public_url)
    except Exception as e:
        print("[decision_pdf] generate_decision_pdf ERROR:", e)

    if not wrote_ok:
        out_dir = Path("uploads") / "protests" / str(regatta_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        file_path = out_dir / f"decision_{protest_id}.pdf"
        file_path.write_bytes(
            tiny_valid_pdf_bytes("Hearing Decision", f"Protest ID: {protest_id}")
        )
        public_url = f"{PUBLIC_BASE_URL}/uploads/protests/{regatta_id}/decision_{protest_id}.pdf"
        public_url = normalize_public_url(public_url)

    # Guardar URL (no Protest; evitar colunas inexistentes no Hearing)
    try:
        p.decision_pdf_url = public_url
        db.add(p)
    except Exception:
        pass

    # Attachment
    try:
        from os.path import basename
        filename = basename(file_path.name) if file_path else f"decision_{protest_id}.pdf"
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
    except Exception as e:
        print("[decision_pdf] attachment save WARN:", e)

    db.commit()

    return {
        "ok": True,
        "protest_id": p.id,
        "hearing_id": h.id,
        "status_after": getattr(p, "status", None),
        "decision_pdf_url": public_url,
        "decision_snapshot": body.model_dump(exclude_none=True),
    }
