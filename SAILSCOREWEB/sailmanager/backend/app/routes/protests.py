# app/routes/protests.py
from __future__ import annotations

import base64
from datetime import datetime
from pathlib import Path
import os
import shutil
from typing import Optional, List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
    BackgroundTasks,
    File,
    UploadFile,
    Form,
)
from sqlalchemy import and_, desc, exists, or_, select
from sqlalchemy.orm import Session, aliased

from app.database import get_db
from app.models import Protest, ProtestParty, Entry, ProtestAttachment
from app import models  # Hearing
from app.schemas import (
    ProtestCreate,
    ProtestInitiatorSummary,
    ProtestPartySummary,
    ProtestDecisionIn,
)
from utils.auth_utils import get_current_user, verify_role
from utils.guards import ensure_regatta_scope
from app.services.email import send_email

router = APIRouter(prefix="/regattas/{regatta_id}/protests", tags=["Protests"])

# ============================================================
# 0) Base pública para URLs absolutos (Opção A)
# ============================================================
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

# ============================================================
# 1) Util para gerar um PDF válido (ReportLab -> fallback base64)
# ============================================================
def _tiny_valid_pdf_bytes(title: str = "SailScore", text: str = "") -> bytes:
    """
    Gera um PDF válido de 1 página.
    1) Tenta usar reportlab (se instalado).
    2) Caso não exista, usa um PDF mínimo pré-construído (base64) que abre em qualquer viewer.
    """
    try:  # pragma: no cover
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from io import BytesIO

        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        c.setTitle(title)
        c.setFont("Helvetica", 12)
        c.drawString(72, 800 - 72, title)
        if text:
            y = 800 - 96
            for line in text.split("\n"):
                c.drawString(72, y, line)
                y -= 16
        c.showPage()
        c.save()
        return buf.getvalue()
    except Exception:
        pass

    # Fallback base64 (PDF mínimo válido, 1 página)
    b64 = (
        "JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBS"
        "Pj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9Db3VudCAxL0tpZHMgWzMgMCBSXT4+CmVu"
        "ZG9iagozIDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3ggWzAgMCA2MTIg"
        "NzkyXS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXMgPDwvUHJvY1NldFsvUERGXSA+PiA+PgplbmRv"
        "YmoKNCAwIG9iago8PC9MZW5ndGggMCA+PgpcbnN0cmVhbQplbmRzdHJlYW0KZW5kb2JqCnhyZWYK"
        "MCA1CjAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDA2MSAwMDAw"
        "MCBuIAowMDAwMDAwMTE2IDAwMDAwIG4gCjAwMDAwMDAyMTMgMDAwMDAgbiAKdHJhaWxlcgo8PC9T"
        "aXplIDUvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoyNzAKJSVFT0Y="
    )
    return base64.b64decode(b64)

# Tenta importar geradores “oficiais”; se não existirem, fica None
try:  # pragma: no cover
    from app.services.pdf import generate_submitted_pdf  # type: ignore
except Exception:  # noqa: BLE001
    generate_submitted_pdf = None  # type: ignore

try:  # pragma: no cover
    from app.services.pdf import generate_decision_pdf  # type: ignore
except Exception:  # noqa: BLE001
    generate_decision_pdf = None  # type: ignore

# ============================================================
# 2) LIST
# ============================================================
@router.get("", response_model=dict)
def list_protests(
    regatta_id: int,
    scope: str = Query("all", regex="^(all|made|against)$"),
    search: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[int] = Query(None, description="id do último item recebido; paginação para trás"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(ensure_regatta_scope),
):
    my_entries_subq = (
        db.query(Entry.id)
        .filter(Entry.regatta_id == regatta_id, Entry.user_id == current_user.id)
        .subquery()
    )

    q = db.query(Protest).filter(Protest.regatta_id == regatta_id)

    made_filter = Protest.initiator_entry_id.in_(select(my_entries_subq.c.id))
    against_filter = exists().where(
        and_(
            ProtestParty.protest_id == Protest.id,
            ProtestParty.entry_id.in_(select(my_entries_subq.c.id)),
        )
    )
    if scope == "made":
        q = q.filter(made_filter)
    elif scope == "against":
        q = q.filter(against_filter)
    else:
        q = q.filter(or_(made_filter, against_filter))

    if cursor is not None:
        q = q.filter(Protest.id < cursor)

    if search:
        ini = aliased(Entry)
        resp = aliased(Entry)
        like = f"%{search}%"
        q = q.outerjoin(ini, Protest.initiator_entry_id == ini.id)
        q = q.outerjoin(ProtestParty, ProtestParty.protest_id == Protest.id)
        q = q.outerjoin(resp, ProtestParty.entry_id == resp.id)
        q = q.filter(
            or_(
                ini.sail_number.ilike(like),
                ini.boat_name.ilike(like),
                resp.sail_number.ilike(like),
                resp.boat_name.ilike(like),
                Protest.race_number.ilike(like),
            )
        )
        q = q.group_by(Protest.id)

    q = q.order_by(desc(Protest.updated_at), desc(Protest.id)).limit(limit + 1)
    rows: List[Protest] = q.all()

    items = []
    for p in rows[:limit]:
        initiator = ProtestInitiatorSummary(
            sail_no=p.initiator_entry.sail_number if p.initiator_entry else None,
            boat_name=p.initiator_entry.boat_name if p.initiator_entry else None,
            class_name=p.initiator_entry.class_name if p.initiator_entry else None,
        )
        respondents: List[ProtestPartySummary] = []
        for party in p.parties:
            if party.entry:
                respondents.append(
                    ProtestPartySummary(
                        sail_no=party.entry.sail_number,
                        boat_name=party.entry.boat_name,
                        class_name=party.entry.class_name,
                        free_text=None,
                    )
                )
            else:
                respondents.append(
                    ProtestPartySummary(
                        sail_no=None,
                        boat_name=None,
                        class_name=None,
                        free_text=party.free_text,
                    )
                )

        items.append(
            {
                "id": p.id,
                "short_code": f"P-{p.id}",
                "type": p.type,
                "status": p.status,
                "race_date": p.race_date,
                "race_number": p.race_number,
                "group_name": p.group_name,
                "initiator": initiator,
                "respondents": respondents,
                "updated_at": p.updated_at,
            }
        )

    has_more = len(rows) > limit
    next_cursor = rows[-1].id if has_more else None
    return {
        "items": items,
        "page_info": {"has_more": has_more, "next_cursor": next_cursor},
    }

# ============================================================
# 3) CREATE (+ snapshot + PDF + attach + hearing auto)
# ============================================================
@router.post("", status_code=status.HTTP_201_CREATED)
def create_protest(
    regatta_id: int,
    body: ProtestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(ensure_regatta_scope),
    background: BackgroundTasks = None,
):
    # validações
    ini = db.query(Entry).filter(Entry.id == body.initiator_entry_id).first()
    if not ini or ini.regatta_id != regatta_id:
        raise HTTPException(status_code=403, detail="Initiator não pertence a esta regata.")
    if ini.user_id != current_user.id and (ini.email or "").strip().lower() != (current_user.email or "").strip().lower():
        raise HTTPException(status_code=403, detail="Não és titular desta inscrição (initiator).")

    resp_ids = [r.entry_id for r in body.respondents if getattr(r, "kind", "entry") == "entry" and r.entry_id]
    if resp_ids:
        cnt_same = db.query(Entry).filter(Entry.id.in_(resp_ids), Entry.regatta_id == regatta_id).count()
        if cnt_same != len(resp_ids):
            raise HTTPException(status_code=422, detail="Há respondentes que não pertencem a esta regata.")

    # cria protesto
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
    db.flush()  # p.id

    for r in body.respondents:
        party = ProtestParty(
            protest_id=p.id,
            kind=getattr(r, "kind", "entry") or "entry",
            entry_id=r.entry_id if getattr(r, "kind", "entry") == "entry" else None,
            free_text=r.free_text if getattr(r, "kind", "entry") != "entry" else None,
            represented_by=getattr(r, "represented_by", None),
        )
        db.add(party)

    db.commit()
    db.refresh(p)

    # snapshot + PDF + attach (Submitted)
    try:
        snapshot = {
            "regatta_id": regatta_id,  # para o pdf.py gravar na pasta da regata
            "type": body.type,
            "race_date": body.race_date,
            "race_number": body.race_number,
            "group_name": body.group_name,
            "initiator_entry_id": body.initiator_entry_id,
            "initiator_represented_by": body.initiator_represented_by,
            "respondents": [
                (r.model_dump() if hasattr(r, "model_dump") else dict(
                    kind=getattr(r, "kind", None),
                    entry_id=getattr(r, "entry_id", None),
                    free_text=getattr(r, "free_text", None),
                    represented_by=getattr(r, "represented_by", None),
                ))
                for r in body.respondents
            ],
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
            "submitted_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }
        p.submitted_snapshot_json = snapshot

        # ===== NOVO BLOCO: PDF "submitted" com fallback =====
        public_url: Optional[str] = None
        file_path: Optional[Path] = None
        written_ok = False

        if generate_submitted_pdf:
            try:
                ret = generate_submitted_pdf(p.id, snapshot)  # pode ser (path, url) ou só url
                if isinstance(ret, (list, tuple)) and len(ret) >= 2:
                    file_path, public_url = Path(ret[0]) if ret[0] else None, ret[1]
                else:
                    file_path, public_url = None, ret  # type: ignore[assignment]

                if file_path and file_path.exists() and file_path.stat().st_size > 0:
                    written_ok = True

                # normaliza URL para absoluto se veio relativo
                if public_url and not str(public_url).startswith("http"):
                    public_url = f"{PUBLIC_BASE_URL}{public_url}"
            except Exception:
                public_url = None
                file_path = None

        if not written_ok:
            # escrever nós próprios em /uploads/protests/<regatta_id>/submitted_<id>.pdf
            uploads_dir = Path("uploads") / "protests" / str(p.regatta_id)
            uploads_dir.mkdir(parents=True, exist_ok=True)
            file_path = uploads_dir / f"submitted_{p.id}.pdf"
            file_path.write_bytes(_tiny_valid_pdf_bytes("Submitted protest", f"Protest ID: {p.id}"))
            public_path = f"/uploads/protests/{p.regatta_id}/submitted_{p.id}.pdf"
            public_url = f"{PUBLIC_BASE_URL}{public_path}"

        # guarda no protesto
        p.submitted_pdf_url = str(public_url)

        # attachment
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

    # hearing auto
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

    # emails (best-effort)
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

# ============================================================
# 4) DECISION (admin)
# ============================================================
@router.patch("/{protest_id}/decision", dependencies=[Depends(verify_role(["admin"]))])
def save_decision(
    regatta_id: int,
    protest_id: int,
    decision: ProtestDecisionIn,
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

    p.decision_json = decision.model_dump()
    # garante que o regatta_id também vai para o gerador (se o usares no pdf.py)
    if isinstance(p.decision_json, dict):
        p.decision_json.setdefault("regatta_id", regatta_id)

    p.decided_at = datetime.utcnow()
    p.decided_by_user_id = current_user.id
    db.add(p)
    db.commit()
    db.refresh(p)

    # ===== NOVO BLOCO: PDF "decision" com fallback =====
    try:
        public_url: Optional[str] = None
        file_path: Optional[Path] = None
        written_ok = False

        if generate_decision_pdf:
            try:
                ret = generate_decision_pdf(p.id, p.decision_json or {})
                if isinstance(ret, (list, tuple)) and len(ret) >= 2:
                    file_path, public_url = Path(ret[0]) if ret[0] else None, ret[1]
                else:
                    file_path, public_url = None, ret  # type: ignore[assignment]

                if file_path and file_path.exists() and file_path.stat().st_size > 0:
                    written_ok = True

                if public_url and not str(public_url).startswith("http"):
                    public_url = f"{PUBLIC_BASE_URL}{public_url}"
            except Exception:
                public_url = None
                file_path = None

        if not written_ok:
            uploads_dir = Path("uploads") / "protests" / str(p.regatta_id)
            uploads_dir.mkdir(parents=True, exist_ok=True)
            file_path = uploads_dir / f"decision_{p.id}.pdf"
            file_path.write_bytes(_tiny_valid_pdf_bytes("Decision", f"Protest ID: {p.id}"))
            public_path = f"/uploads/protests/{p.regatta_id}/decision_{p.id}.pdf"
            public_url = f"{PUBLIC_BASE_URL}{public_path}"

        p.decision_pdf_url = str(public_url)

        db.add(ProtestAttachment(
            protest_id=p.id,
            kind="decision_pdf",
            filename=os.path.basename(str(public_url)),
            content_type="application/pdf",
            size=(file_path.stat().st_size if file_path else 0),
            url=p.decision_pdf_url,
            uploaded_by_user_id=current_user.id,
        ))
        db.add(p)
        db.commit()
    except Exception as err:
        db.rollback()
        print(f"[PROTEST_DECISION_PDF][protest={p.id}] falhou: {err}")

    return {"ok": True, "decision_pdf_url": p.decision_pdf_url}

# ============================================================
# 5) ATTACHMENTS (uploads genéricos, admin)
# ============================================================
@router.get("/{protest_id}/attachments")
def list_attachments(
    regatta_id: int,
    protest_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
    __=Depends(ensure_regatta_scope),
):
    rows = (
        db.query(ProtestAttachment)
        .filter(ProtestAttachment.protest_id == protest_id)
        .order_by(ProtestAttachment.created_at.asc())
        .all()
    )
    return [
        {
            "id": a.id,
            "kind": a.kind,
            "filename": a.filename,
            "url": a.url,
            "content_type": a.content_type,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in rows
    ]

@router.post("/{protest_id}/attachments", dependencies=[Depends(verify_role(["admin"]))])
def upload_attachment(
    regatta_id: int,
    protest_id: int,
    kind: str = Form("admin_upload"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(ensure_regatta_scope),
):
    # destino: uploads/protests/<regatta_id>/<protest_id>/<filename>
    safe_name = os.path.basename(file.filename or "upload.bin")
    dest_dir = Path("uploads") / "protests" / str(regatta_id) / str(protest_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / safe_name

    with dest_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    # URL absoluto (Opção A)
    public_url = f"{PUBLIC_BASE_URL}/uploads/protests/{regatta_id}/{protest_id}/{safe_name}"

    a = ProtestAttachment(
        protest_id=protest_id,
        kind=kind,
        filename=safe_name,
        content_type=file.content_type or "application/octet-stream",
        size=dest_path.stat().st_size,
        url=public_url,
        uploaded_by_user_id=current_user.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"id": a.id, "url": a.url}
