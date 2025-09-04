from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    """
    Lista protestos onde o utilizador é iniciador (made) e/ou respondente (against)
    na regata do token (para regatista). Admin vê tudo.
    """
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

    # cursor (id menor que o cursor anterior)
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
                    Protest.race_number.ilike(like),
                )
            )
             .group_by(Protest.id)
        )

    q = q.order_by(desc(Protest.updated_at), desc(Protest.id)).limit(limit + 1)
    rows: List[Protest] = q.all()

    # construir resposta
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
):
    # valida iniciador (tem de ser entry do user nesta regata)
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

    # cria protesto
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
    )
    db.add(p)
    db.flush()  # para ter p.id

    # partes (respondentes)
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
    return {"id": p.id, "short_code": f"P-{p.id}"}
