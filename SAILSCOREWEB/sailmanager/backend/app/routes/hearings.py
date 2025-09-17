from __future__ import annotations

from datetime import date, time, datetime
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, load_only  # 👈 acrescenta load_only

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
        if isinstance(d, (date, datetime)):
            return d.date().isoformat() if isinstance(d, datetime) else d.isoformat()
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
        for party in parties:  # preferir entry
            e = getattr(party, "entry", None)
            if e:
                s = _fmt_entry(e)
                if s:
                    return s
        for party in parties:  # fallback: free_text
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
    if s == "CLOSED":
        return "CLOSED"
    return "OPEN"  # qualquer outro valor conta como aberto


def _fallback_updated_at(h) -> str:
    """Como não tens coluna updated_at na BD, devolvemos um ISO aproximado."""
    d = _fmt_date(getattr(h, "sch_date", None))
    t = _fmt_time(getattr(h, "sch_time", None))
    if d and t:
        return f"{d}T{t}:00Z"
    if d:
        return f"{d}T00:00:00Z"
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


# -------------------------
# Endpoints
# -------------------------

@router.get("/{regatta_id}")
def list_hearings(
    regatta_id: int,
    status_q: Literal["all", "open", "closed"] = Query("all"),
    db: Session = Depends(get_db),
):
    """
    Lista pública (sem auth).
    Resposta:
    { "items": [...], "page_info": { "has_more": false, "next_cursor": null } }
    """
    # ⚠️ Carrega apenas colunas que EXISTEM na tabela
    q = (
        db.query(models.Hearing)
        .filter(models.Hearing.regatta_id == regatta_id)
        .options(
            load_only(  # 👈 evita created_at/updated_at e outras que não existam
                models.Hearing.id,
                models.Hearing.regatta_id,
                models.Hearing.protest_id,
                models.Hearing.case_number,
                models.Hearing.decision,
                models.Hearing.sch_date,
                models.Hearing.sch_time,
                models.Hearing.room,
                models.Hearing.status,
            )
        )
        .order_by(models.Hearing.case_number.asc(), models.Hearing.id.asc())
    )

    rows = q.all()

    # filtro de estado (normalizado)
    if status_q != "all":
        want = "OPEN" if status_q == "open" else "CLOSED"
        rows = [h for h in rows if _normalize_status(getattr(h, "status", None)) == want]

    # pré-carrega Protests com initiator_entry e parties.entry
    protests_by_id = {}
    protest_ids = [h.protest_id for h in rows if getattr(h, "protest_id", None)]
    Protest = getattr(models, "Protest", None)
    if Protest and protest_ids:
        protests = (
            db.query(Protest)
            .options(
                joinedload("initiator_entry"),
                joinedload("parties").joinedload("entry"),
            )
            .filter(Protest.id.in_(protest_ids))
            .all()
        )
        protests_by_id = {p.id: p for p in protests}

    items = []
    for h in rows:
        p = protests_by_id.get(getattr(h, "protest_id", None)) if protests_by_id else None
        items.append(
            {
                "id": h.id,
                "case_number": h.case_number,
                "race": _race_label(p),
                "initiator": _initiator_str(p),
                "respondent": _respondent_str(p),
                "decision": getattr(h, "decision", None),
                "sch_date": _fmt_date(getattr(h, "sch_date", None)),
                "sch_time": _fmt_time(getattr(h, "sch_time", None)),
                "room": getattr(h, "room", None),
                "status": _normalize_status(getattr(h, "status", None)),
                "updated_at": _fallback_updated_at(h),  # 👈 mantém o contrato do FE
            }
        )

    return {"items": items, "page_info": {"has_more": False, "next_cursor": None}}


@router.post(
    "/for-protest/{protest_id}",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_role(["admin"]))],
)
def create_hearing_for_protest(protest_id: int, db: Session = Depends(get_db)):
    Protest = getattr(models, "Protest", None)
    if Protest is None:
        raise HTTPException(status_code=400, detail="Modelo Protest não disponível.")

    p = db.query(Protest).filter(Protest.id == protest_id).first()
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
