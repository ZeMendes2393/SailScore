from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy import and_, desc, exists, or_, select
from sqlalchemy.orm import Session, aliased

from app.database import get_db
from app.models import Protest, ProtestParty, Entry
from app.schemas import (
    ProtestCreate,
    ProtestInitiatorSummary,
    ProtestPartySummary,
)
from utils.auth_utils import get_current_user
from utils.guards import ensure_regatta_scope
from app.services.email import send_email  # 👈 usa o teu serviço

router = APIRouter(prefix="/regattas/{regatta_id}/protests", tags=["Protests"])

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
    # entries do utilizador nesta regata
    my_entries_subq = (
        db.query(Entry.id)
        .filter(Entry.regatta_id == regatta_id, Entry.user_id == current_user.id)
        .subquery()
    )

    # base query
    q = db.query(Protest).filter(Protest.regatta_id == regatta_id)

    # scope
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
    else:  # all
        q = q.filter(or_(made_filter, against_filter))

    # cursor
    if cursor is not None:
        q = q.filter(Protest.id < cursor)

    # pesquisa (sail no / boat / race_number)
    if search:
        ini = aliased(Entry)
        resp = aliased(Entry)
        like = f"%{search}%"
        q = (
            q.outerjoin(ini, Protest.initiator_entry_id == ini.id)
             .outerjoin(ProtestParty, ProtestParty.protest_id == Protest.id)
             .outerjoin(resp, ProtestParty.entry_id == resp.id)
             .filter(
                or_(
                    ini.sail_number.ilike(like),
                    ini.boat_name.ilike(like),
                    resp.sail_number.ilike(like),
                    resp.boat_name.ilike(like),
                    Protest.race_number.ilike(like),  # race_number é String no teu modelo
                )
            )
             .group_by(Protest.id)
        )

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
    return {"items": items, "page_info": {"has_more": has_more, "next_cursor": next_cursor}}

@router.post("", status_code=status.HTTP_201_CREATED)
def create_protest(
    regatta_id: int,
    body: ProtestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(ensure_regatta_scope),
    background: BackgroundTasks = None,  # 👈 background tasks
):
    # valida iniciador
    initiator = (
        db.query(Entry)
        .filter(
            Entry.id == body.initiator_entry_id,
            Entry.regatta_id == regatta_id,
            Entry.user_id == current_user.id,
        )
        .first()
    )
    if not initiator:
        raise HTTPException(status_code=403, detail="Initiator inválido para este utilizador/regata")

    if not body.respondents:
        raise HTTPException(status_code=422, detail="Pelo menos um respondente é obrigatório")

    # valida respondentes
    for idx, r in enumerate(body.respondents):
        if r.kind == "entry":
            entry = db.query(Entry).filter(Entry.id == r.entry_id, Entry.regatta_id == regatta_id).first()
            if not entry:
                raise HTTPException(
                    status_code=422,
                    detail=f"Respondente #{idx+1}: entry inválida para esta regata"
                )
            if r.entry_id == body.initiator_entry_id:
                raise HTTPException(
                    status_code=422,
                    detail="O iniciador não pode ser também respondente"
                )
        else:
            if not (r.free_text and r.free_text.strip()):
                raise HTTPException(
                    status_code=422,
                    detail=f"Respondente #{idx+1}: free_text é obrigatório quando kind='other'"
                )

    # cria protesto (com 'incident' aninhado ou fallback plano)
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
    db.flush()  # p.id disponível

    for r in body.respondents:
        party = ProtestParty(
            protest_id=p.id,
            kind=r.kind or "entry",
            entry_id=r.entry_id if r.kind == "entry" else None,
            free_text=r.free_text if r.kind != "entry" else None,
            represented_by=r.represented_by,
        )
        db.add(party)

    db.commit()

    # ---------- Notificação por email (respondentes) ----------
    # junta emails de todas as entries respondentes
    try:
        resp_ids = [r.entry_id for r in body.respondents if getattr(r, "kind", "entry") == "entry" and r.entry_id]
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
                    background.add_task(send_email, to, subject, None, text)  # usa o teu serviço
    except Exception:
        # não falhar o request por causa do email
        pass

    return {"id": p.id, "short_code": f"P-{p.id}"}
