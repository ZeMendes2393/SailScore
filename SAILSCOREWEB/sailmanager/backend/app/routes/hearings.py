from __future__ import annotations

from datetime import date, time, datetime
from typing import Optional, Literal, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, load_only, joinedload

from app.database import get_db
from app import models, schemas
from utils.auth_utils import verify_role

router = APIRouter(prefix="/hearings", tags=["hearings"])


# -------------------------
# Helpers de formatação
# -------------------------
def _fmt_date(d) -> Optional[str]:
    if not d:
        return None
    try:
        if isinstance(d, datetime):
            return d.date().isoformat()
        if isinstance(d, date):
            return d.isoformat()
        return str(d)
    except Exception:
        return None


def _fmt_time(t) -> Optional[str]:
    if not t:
        return None
    try:
        if isinstance(t, (time, datetime)):
            return t.strftime("%H:%M")
        s = str(t)
        return s[:5] if len(s) >= 5 else s
    except Exception:
        return None


def _fmt_entry(e) -> Optional[str]:
    if not e:
        return None
    parts = []
    main = (getattr(e, "sail_number", None) or getattr(e, "boat_name", None) or "").strip()
    cls = (getattr(e, "class_name", None) or "").strip()
    if main:
        parts.append(main)
    if cls:
        parts.append(cls)
    return " · ".join(parts) if parts else None


def _initiator_str(p) -> str:
    try:
        return _fmt_entry(getattr(p, "initiator_entry", None)) or "—"
    except Exception:
        return "—"


def _respondent_str(p) -> str:
    try:
        parties = getattr(p, "parties", None) or []
        # preferir entry
        for party in parties:
            e = getattr(party, "entry", None)
            if e:
                s = _fmt_entry(e)
                if s:
                    return s
        # fallback: free_text
        for party in parties:
            ft = (getattr(party, "free_text", None) or "").strip()
            if ft:
                return ft
        return "—"
    except Exception:
        return "—"


def _race_label(p) -> str:
    try:
        for k in ("race_number", "race", "heat"):
            v = getattr(p, k, None)
            if v:
                return str(v)
        rd = getattr(p, "race_date", None)
        if rd:
            return str(rd)
        return "—"
    except Exception:
        return "—"


def _normalize_status(s: Optional[str]) -> str:
    s = (s or "").upper()
    return "CLOSED" if s == "CLOSED" else "OPEN"


def _safe_updated_at(h) -> str:
    """
    Mantém contrato do FE para updated_at.
    Tenta updated_at/created_at; senão cai para sch_date/sch_time; senão UTC now.
    """
    val = getattr(h, "updated_at", None) or getattr(h, "created_at", None)
    try:
        if isinstance(val, datetime):
            return val.replace(microsecond=0).isoformat().replace("+00:00", "Z")
        if val:
            return str(val)
    except Exception:
        pass

    d = _fmt_date(getattr(h, "sch_date", None))
    t = _fmt_time(getattr(h, "sch_time", None))
    if d and t:
        return f"{d}T{t}:00Z"
    if d:
        return f"{d}T00:00:00Z"
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


# -------------------------
# Helpers de PDF (opção 1: sempre derivado do snapshot)
# -------------------------
def _render_decision_pdf(snapshot: dict, hearing: models.Hearing) -> str:
    """
    Gera/sobrescreve o PDF da decisão a partir do snapshot e devolve o URL público.
    Implementa aqui a tua rotina real (WeasyPrint, ReportLab, etc).
    Mantém SEMPRE o mesmo path para sobrescrever (sem versionamento).
    """
    # Exemplo de caminho fixo (ajusta para o teu setup de static files):
    pdf_path = f"static/decisions/hearing-{hearing.id}.pdf"
    # TODO: render_pdf(snapshot, out_path=pdf_path)
    # e.g.: weasyprint.HTML(string=html).write_pdf(pdf_path)
    public_url = f"/{pdf_path}"  # assumindo que /static é servido publicamente
    return public_url


# -------------------------
# Endpoints
# -------------------------

def create_hearing_for_protest(protest_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Protest).filter(models.Protest.id == protest_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Protesto não encontrado")

    regatta_id = getattr(p, "regatta_id", None)
    if not regatta_id:
        raise HTTPException(status_code=400, detail="Protesto sem regatta_id")

    last = (
        db.query(models.Hearing.case_number)
        .filter(models.Hearing.regatta_id == regatta_id)
        .order_by(models.Hearing.case_number.desc())
        .first()
    )
    next_case = (last[0] if last and last[0] else 0) + 1

    h = models.Hearing(
        regatta_id=int(regatta_id),
        protest_id=int(protest_id),
        case_number=next_case,
        status="OPEN",
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return {"id": h.id, "case_number": h.case_number}


# >>> criar hearing a partir de um protesto (admin) <<<
@router.post(
    "/for-protest/{protest_id}",
    status_code=201,
    dependencies=[Depends(verify_role(["admin"]))],
)
def create_for_protest(protest_id: int, db: Session = Depends(get_db)):
    # evita duplicados: se já existir hearing para este protesto, devolve-o
    exists = db.query(models.Hearing).filter(models.Hearing.protest_id == protest_id).first()
    if exists:
        return {"id": exists.id, "case_number": exists.case_number}
    return create_hearing_for_protest(protest_id, db)


@router.patch(
    "/{hearing_id}",
    dependencies=[Depends(verify_role(["admin"]))],
)
def update_hearing(hearing_id: int, payload: schemas.HearingPatch, db: Session = Depends(get_db)):
    h = db.query(models.Hearing).filter(models.Hearing.id == hearing_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hearing não encontrado")

    patch = payload.model_dump(exclude_unset=True)

    if "status" in patch:
        s = (patch["status"] or "").upper()
        if s not in ("OPEN", "CLOSED"):
            raise HTTPException(status_code=422, detail="status deve ser 'OPEN' ou 'CLOSED'")
        patch["status"] = s

    for k, v in patch.items():
        setattr(h, k, v)

    db.add(h)
    db.commit()
    db.refresh(h)
    return {"ok": True}


@router.delete(
    "/{hearing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_role(["admin"]))],
)
def delete_hearing(hearing_id: int, db: Session = Depends(get_db)):
    h = db.query(models.Hearing).filter(models.Hearing.id == hearing_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hearing não encontrado")
    db.delete(h)
    db.commit()
    return


@router.get("/{regatta_id}")
def list_hearings(
    regatta_id: int,
    status_q: Literal["all", "open", "closed"] = Query("all"),
    db: Session = Depends(get_db),
):
    q = (
        db.query(models.Hearing)
        .filter(models.Hearing.regatta_id == regatta_id)
        .options(
            load_only(
                models.Hearing.id,
                models.Hearing.regatta_id,
                models.Hearing.protest_id,
                models.Hearing.case_number,
                models.Hearing.decision,
                models.Hearing.sch_date,
                models.Hearing.sch_time,
                models.Hearing.room,
                models.Hearing.status,
                # NOTA: NÃO incluir decision_pdf_url aqui
            )
        )
        .order_by(models.Hearing.case_number.asc(), models.Hearing.id.asc())
    )
    rows = q.all()

    if status_q != "all":
        want = "OPEN" if status_q == "open" else "CLOSED"
        rows = [h for h in rows if _normalize_status(getattr(h, "status", None)) == want]

    protests_by_id: Dict[int, object] = {}
    protest_ids = [h.protest_id for h in rows if getattr(h, "protest_id", None)]
    if protest_ids:
        protests = (
            db.query(models.Protest)
            .options(
                joinedload(models.Protest.initiator_entry),
                joinedload(models.Protest.parties).joinedload(models.ProtestParty.entry),
            )
            .filter(models.Protest.id.in_(protest_ids))
            .all()
        )
        protests_by_id = {p.id: p for p in protests}

    items = []
    for h in rows:
        p = protests_by_id.get(getattr(h, "protest_id", None)) if protests_by_id else None

        # Texto da decisão (com fallbacks)
        decision_txt = getattr(h, "decision", None)
        if not decision_txt and p is not None:
            snap_p = getattr(p, "decision_json", None) or {}
            decision_txt = snap_p.get("short_decision") or snap_p.get("decision_text")
        if decision_txt and len(str(decision_txt)) > 280:
            decision_txt = str(decision_txt)[:277] + "…"

        # URL do PDF da decisão (hearing -> protest) com try/except
        try:
            dec_pdf = getattr(h, "decision_pdf_url")
        except Exception:
            dec_pdf = None
        if not dec_pdf and p:
            dec_pdf = getattr(p, "decision_pdf_url", None)
        decision_pdf_url = dec_pdf

        items.append(
            {
                "id": h.id,
                "case_number": h.case_number,
                "race": _race_label(p),
                "initiator": _initiator_str(p),
                "respondent": _respondent_str(p),
                "decision": decision_txt,
                "sch_date": _fmt_date(getattr(h, "sch_date", None)),
                "sch_time": _fmt_time(getattr(h, "sch_time", None)),
                "room": getattr(h, "room", None),
                "status": _normalize_status(getattr(h, "status", None)),
                "updated_at": _safe_updated_at(h),

                # úteis no FE
                "protest_id": getattr(h, "protest_id", None),
                "decision_pdf_url": decision_pdf_url,

                # ✅ SUBMITTED volta a sair no payload
                "submitted_pdf_url": getattr(p, "submitted_pdf_url", None) if p else None,
            }
        )

    return {"items": items, "page_info": {"has_more": False, "next_cursor": None}}


@router.get("/by-id/{hearing_id}")
def get_hearing(hearing_id: int, db: Session = Depends(get_db)):
    h = db.query(models.Hearing).filter(models.Hearing.id == hearing_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hearing não encontrado")

    p = None
    if h.protest_id:
        p = (
            db.query(models.Protest)
            .options(
                joinedload(models.Protest.initiator_entry),
                joinedload(models.Protest.parties).joinedload(models.ProtestParty.entry),
            )
            .filter(models.Protest.id == h.protest_id)
            .first()
        )

    snap_h = getattr(h, "decision_snapshot_json", None) or {}
    snap_p = getattr(p, "decision_json", None) or {}

    decision_txt = (
        getattr(h, "decision", None)
        or snap_h.get("short_decision")
        or snap_h.get("decision_text")
        or snap_p.get("short_decision")
        or snap_p.get("decision_text")
    )
    if decision_txt and len(str(decision_txt)) > 280:
        decision_txt = str(decision_txt)[:277] + "…"

    # PDF da decisão com try/except + fallback ao Protest
    try:
        dec_pdf = getattr(h, "decision_pdf_url")
    except Exception:
        dec_pdf = None
    if not dec_pdf and p:
        dec_pdf = getattr(p, "decision_pdf_url", None)

    return {
        "id": h.id,
        "regatta_id": h.regatta_id,
        "protest_id": h.protest_id,
        "case_number": h.case_number,
        "status": _normalize_status(getattr(h, "status", None)),
        "decision": decision_txt,
        "decision_pdf_url": dec_pdf,
        "submitted_pdf_url": getattr(p, "submitted_pdf_url", None) if p else None,
    }


# >>> NOVO: (Re)gerar PDF da decisão a partir do snapshot (sem versões) <<<
@router.post(
    "/{hearing_id}/decision/pdf",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_role(["admin"]))],
)
def regenerate_decision_pdf(hearing_id: int, db: Session = Depends(get_db)):
    h = db.query(models.Hearing).filter(models.Hearing.id == hearing_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hearing não encontrado")

    if not getattr(h, "decision_snapshot_json", None):
        raise HTTPException(
            status_code=400,
            detail="Não há decisão guardada. 'Open decision' e 'Save' primeiro."
        )

    try:
        url = _render_decision_pdf(h.decision_snapshot_json, h)  # sobrescreve o mesmo ficheiro
        h.decision_pdf_url = url
        h.decision_at = datetime.utcnow()
        db.commit()
        db.refresh(h)
        # devolve payload leve; o FE faz refresh a seguir
        return {
            "ok": True,
            "id": h.id,
            "decision_pdf_url": h.decision_pdf_url,
            "decision_at": h.decision_at.isoformat() if h.decision_at else None,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Falha ao gerar PDF: {e}")
