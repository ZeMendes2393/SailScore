from __future__ import annotations

from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, desc, exists, or_, select
from sqlalchemy.orm import Session, aliased

from app.database import get_db
from app.models import Protest, ProtestParty, Entry
from app.schemas import ProtestInitiatorSummary, ProtestPartySummary
from utils.auth_utils import get_current_user
from utils.guards import ensure_regatta_scope

router = APIRouter()

@router.get("/", response_model=dict)  # <- importante: "/" (não vazio)
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

    rows: List[Protest] = (
        q.order_by(desc(Protest.updated_at), desc(Protest.id))
         .limit(limit + 1)
         .all()
    )

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
