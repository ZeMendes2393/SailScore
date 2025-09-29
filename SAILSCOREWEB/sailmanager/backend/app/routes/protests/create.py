from __future__ import annotations

from datetime import datetime
from pathlib import Path
import os
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Protest, ProtestParty, Entry, ProtestAttachment
from app import models
from app.schemas import ProtestCreate
from utils.auth_utils import get_current_user
from utils.guards import ensure_regatta_scope
from app.services.email import send_email

# helpers comuns que criaste
from .helpers import (
    PUBLIC_BASE_URL,
    tiny_valid_pdf_bytes,
    generate_submitted_pdf,
    normalize_public_url,
)

router = APIRouter()

@router.post("/", status_code=status.HTTP_201_CREATED)  # path vazio (correto)
def create_protest(
    regatta_id: int,
    body: ProtestCreate,
    background: BackgroundTasks,                     # <-- sem Optional e ANTES dos Depends
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(ensure_regatta_scope),
):
    # --- validações ---
    ini = db.query(Entry).filter(Entry.id == body.initiator_entry_id).first()
    if not ini or ini.regatta_id != regatta_id:
        raise HTTPException(status_code=403, detail="Initiator não pertence a esta regata.")
    if ini.user_id != current_user.id and (ini.email or "").strip().lower() != (current_user.email or "").strip().lower():
        raise HTTPException(status_code=403, detail="Não és titular desta inscrição (initiator).")

    resp_ids: List[int] = [r.entry_id for r in body.respondents if getattr(r, "kind", "entry") == "entry" and r.entry_id]
    if resp_ids:
        cnt_same = db.query(Entry).filter(Entry.id.in_(resp_ids), Entry.regatta_id == regatta_id).count()
        if cnt_same != len(resp_ids):
            raise HTTPException(status_code=422, detail="Há respondentes que não pertencem a esta regata.")

    # --- cria protesto ---
    incident = getattr(body, "incident", None)
    p = Protest(
        regatta_id=regatta_id,
        type=body.type,
        race_date=body.race_date,
        race_number=body.race_number,
        group_name=body.group_name,
        initiator_entry_id=body.initiator_entry_id,
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

    # -------- snapshot enriquecido --------
    regatta_name = None
    regatta_venue = None
    try:
        from app.models import Regatta
        reg = db.query(Regatta).filter(Regatta.id == regatta_id).first()
        if reg:
            regatta_name = getattr(reg, "name", None)
            regatta_venue = getattr(reg, "venue", None) or getattr(reg, "location", None)
    except Exception:
        pass

    initiator_view = {
        "entry_id": ini.id if ini else body.initiator_entry_id,
        "sail_no": getattr(ini, "sail_number", None),
        "boat_name": getattr(ini, "boat_name", None),
        "class_name": getattr(ini, "class_name", None),
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
                    "boat_name": e.boat_name,
                    "class_name": e.class_name,
                })
        respondents_view.append(item)

    snapshot = {
        "regatta_id": regatta_id,
        "regatta_name": regatta_name,
        "venue": regatta_venue,  # usa a chave 'venue' para o cabeçalho do PDF
        "type": body.type,
        "group_name": body.group_name,
        "race_date": body.race_date,
        "race_number": body.race_number,
        "submitted_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
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
                if getattr(body, "incident_when_where", None) or getattr(body, "incident_description", None) or getattr(body, "rules_alleged", None)
                else None
            )
        ),
    }
    p.submitted_snapshot_json = snapshot

    # -------- PDF + attachment (submitted) --------
    try:
        public_url: Optional[str] = None
        file_path: Optional[Path] = None
        written_ok = False

        # 1) serviço oficial
        try:
            ret = generate_submitted_pdf(regatta_id, p.id, snapshot)  # (disk_path, public_url)
            if isinstance(ret, (list, tuple)) and len(ret) >= 2:
                file_path, public_url = Path(ret[0]) if ret[0] else None, ret[1]
            else:
                file_path, public_url = None, ret  # type: ignore[assignment]
            if file_path and file_path.exists() and file_path.stat().st_size > 0:
                written_ok = True
            public_url = normalize_public_url(public_url)
        except Exception as e:
            print("[PDF][submitted] serviço falhou, fallback:", e)
            public_url = None
            file_path = None

        # 2) fallback
        if not written_ok:
            uploads_dir = Path("uploads") / "protests" / str(p.regatta_id)
            uploads_dir.mkdir(parents=True, exist_ok=True)
            file_path = uploads_dir / f"submitted_{p.id}.pdf"
            file_path.write_bytes(tiny_valid_pdf_bytes("Submitted protest", f"Protest ID: {p.id}"))
            public_url = f"{PUBLIC_BASE_URL}/uploads/protests/{p.regatta_id}/submitted_{p.id}.pdf"

        p.submitted_pdf_url = str(public_url)

        db.add(ProtestAttachment(
            protest_id=p.id,
            kind="submitted_pdf",
            filename=os.path.basename(str(public_url)),
            content_type="application/pdf",
            size=(file_path.stat().st_size if file_path else 0),
            url=p.submitted_pdf_url,
            uploaded_by_user_id=current_user.id,
        ))
        db.add(p)
        db.commit()
        db.refresh(p)

    except Exception as pdf_err:
        db.rollback()
        print(f"[PROTEST_SUBMIT_PDF][protest={p.id}] falhou: {pdf_err}")

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

    # -------- emails (best-effort) --------
    try:
        if resp_ids and background:
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
