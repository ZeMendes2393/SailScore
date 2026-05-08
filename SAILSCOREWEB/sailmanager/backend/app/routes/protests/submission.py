"""Snapshot JSON + PDF submetido (criação e atualização de protestos)."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import os
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import Protest, ProtestAttachment, Entry, Regatta
from app.schemas import ProtestCreate
from app.services.pdf import generate_submitted_pdf
from app.storage_uploads import delete_stored_upload, save_binary_upload
from app.services.pdf.generators import (
    build_submitted_pdf_initiator_rows,
    build_submitted_pdf_respondent_rows,
)

from .helpers import tiny_valid_pdf_bytes, normalize_public_url


def apply_submitted_snapshot_and_pdf(
    db: Session,
    p: Protest,
    body: ProtestCreate,
    ini: Optional[Entry],
    regatta_id: int,
    current_user_id: int,
    *,
    replace_submitted_pdfs: bool = False,
) -> None:
    """Atualiza submitted_snapshot_json e gera PDF de submissão (commit incluído)."""
    if replace_submitted_pdfs:
        old_rows = db.query(ProtestAttachment).filter(
            ProtestAttachment.protest_id == p.id,
            ProtestAttachment.kind == "submitted_pdf",
        ).all()
        for old in old_rows:
            delete_stored_upload(old.url or "")
            db.delete(old)
        db.flush()

    regatta_name = None
    regatta_venue = None
    try:
        reg = db.query(Regatta).filter(Regatta.id == regatta_id).first()
        if reg:
            regatta_name = getattr(reg, "name", None)
            regatta_venue = getattr(reg, "venue", None) or getattr(reg, "location", None)
    except Exception:
        pass

    incident = getattr(body, "incident", None)
    party_txt = (body.initiator_party_text or "").strip() or None
    initiator_view = {
        "entry_id": ini.id if ini else body.initiator_entry_id,
        "party_text": party_txt if not ini else None,
        "sail_no": getattr(ini, "sail_number", None) if ini else None,
        "boat_country_code": getattr(ini, "boat_country_code", None) if ini else None,
        "boat_name": getattr(ini, "boat_name", None) if ini else None,
        "class_name": getattr(ini, "class_name", None) if ini else None,
        "represented_by": body.initiator_represented_by,
    }

    respondents_view: List[dict] = []
    for r in body.respondents:
        item = {
            "kind": getattr(r, "kind", "entry") or "entry",
            "entry_id": getattr(r, "entry_id", None),
            "free_text": getattr(r, "free_text", None),
            "represented_by": getattr(r, "represented_by", None),
            "sail_no": None,
            "boat_name": None,
            "class_name": None,
        }
        if item["kind"] == "entry" and item["entry_id"]:
            e = db.query(Entry).filter(Entry.id == item["entry_id"]).first()
            if e:
                item.update({
                    "sail_no": e.sail_number,
                    "boat_country_code": getattr(e, "boat_country_code", None),
                    "boat_name": e.boat_name,
                    "class_name": e.class_name,
                })
        respondents_view.append(item)

    submitted_at_iso = (
        p.received_at.isoformat(timespec="seconds") + "Z"
        if p.received_at
        else datetime.utcnow().isoformat(timespec="seconds") + "Z"
    )

    snapshot = {
        "regatta_id": regatta_id,
        "regatta_name": regatta_name,
        "venue": regatta_venue,
        "type": body.type,
        "group_name": body.group_name,
        "race_date": body.race_date,
        "race_number": body.race_number,
        "submitted_at": submitted_at_iso,
        "initiator": initiator_view,
        "respondents": respondents_view,
        "incident": (
            body.incident.model_dump()
            if getattr(body, "incident", None) and hasattr(body.incident, "model_dump")
            else (
                {
                    "when_where": getattr(body, "incident_when_where", None),
                    "description": getattr(body, "incident_description", None),
                    "rules_applied": getattr(body, "rules_alleged", None),
                    "damage_injury": None,
                }
                if getattr(body, "incident_when_where", None)
                or getattr(body, "incident_description", None)
                or getattr(body, "rules_alleged", None)
                else None
            )
        ),
    }
    p.submitted_snapshot_json = snapshot

    try:
        public_url: Optional[str] = None
        file_path: Optional[Path] = None
        written_ok = False

        try:
            ret = generate_submitted_pdf(regatta_id, p.id, snapshot)
            if isinstance(ret, (list, tuple)) and len(ret) >= 2:
                file_path, public_url = Path(ret[0]) if ret[0] else None, ret[1]
            else:
                file_path, public_url = None, ret  # type: ignore[assignment]
            if file_path and file_path.exists() and file_path.stat().st_size > 0:
                written_ok = True
                try:
                    content = file_path.read_bytes()
                    public_url = save_binary_upload(
                        subdir=f"protests/{p.regatta_id}",
                        filename=f"submitted_{p.id}.pdf",
                        content=content,
                        content_type="application/pdf",
                    )
                except Exception:
                    public_url = normalize_public_url(public_url)
            else:
                public_url = normalize_public_url(public_url)
        except Exception as e:
            print("[PDF][submitted] serviço falhou, fallback:", e)
            public_url = None
            file_path = None

        if not written_ok:
            init = (snapshot.get("initiator") or {})
            inc_s = (snapshot.get("incident") or {})
            respondents = (snapshot.get("respondents") or [])

            lines = [
                f"Protest ID: {p.id}",
                f"Regatta: {snapshot.get('regatta_name') or '—'}",
                f"Venue: {snapshot.get('venue') or '—'}",
                f"Type: {snapshot.get('type') or '—'}   Group/Fleet: {snapshot.get('group_name') or '—'}",
                f"Race Date: {snapshot.get('race_date') or '—'}   Race Number: {snapshot.get('race_number') or '—'}",
                f"Submitted At: {snapshot.get('submitted_at') or '—'}",
                "",
                "Initiator:",
            ]
            for label, val in build_submitted_pdf_initiator_rows(init):
                lines.append(f"  {label}: {val}")
            lines.append("")
            if respondents:
                lines.append("Respondents:")
                for i, r in enumerate(respondents, 1):
                    lines.append(f"  [{i}]")
                    for label, val in build_submitted_pdf_respondent_rows(r):
                        lines.append(f"    {label}: {val}")
            else:
                lines.append("Respondents: —")
            lines += [
                "",
                f"When/Where: {inc_s.get('when_where') or snapshot.get('incident_when_where') or '—'}",
                f"Description: {inc_s.get('description') or snapshot.get('incident_description') or '—'}",
                f"Rules Alleged: {inc_s.get('rules_applied') or snapshot.get('rules_alleged') or '—'}",
            ]
            pdf_bytes = tiny_valid_pdf_bytes("Protest — Submission", lines)
            public_url = save_binary_upload(
                subdir=f"protests/{p.regatta_id}",
                filename=f"submitted_{p.id}.pdf",
                content=pdf_bytes,
                content_type="application/pdf",
            )
            file_path = None

        p.submitted_pdf_url = normalize_public_url(str(public_url))

        db.add(ProtestAttachment(
            protest_id=p.id,
            kind="submitted_pdf",
            filename=os.path.basename(str(public_url)),
            content_type="application/pdf",
            size=(file_path.stat().st_size if file_path and file_path.exists() else (len(pdf_bytes) if 'pdf_bytes' in locals() else 0)),
            url=p.submitted_pdf_url,
            uploaded_by_user_id=current_user_id,
        ))
        db.add(p)
        db.commit()
        db.refresh(p)

    except Exception as pdf_err:
        db.rollback()
        print(f"[PROTEST_SUBMIT_PDF][protest={p.id}] falhou: {pdf_err}")
