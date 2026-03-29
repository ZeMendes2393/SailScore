# app/routes/rule42.py
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import and_, or_, desc, func
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.org_scope import assert_user_can_manage_org_id
from app.jury_scope import assert_jury_regatta_access
from utils.auth_utils import get_current_user, get_current_user_optional

router = APIRouter(prefix="/rule42", tags=["rule42"])


def _ensure_rule42_write(db: Session, user: models.User, regatta_id: int) -> None:
    """Admin/org admin ou jury da mesma regata e organização."""
    if user.role in ("admin", "platform_admin"):
        regatta = db.query(models.Regatta).filter_by(id=regatta_id).first()
        if not regatta:
            raise HTTPException(status_code=404, detail="Regatta not found")
        assert_user_can_manage_org_id(user, regatta.organization_id)
        return
    if user.role == "jury":
        assert_jury_regatta_access(db, user, regatta_id)
        return
    raise HTTPException(status_code=403, detail="Forbidden")

# ============================================
# LISTAR (original) — array "cru"
# ============================================
@router.get("/{regatta_id}", response_model=List[schemas.Rule42Out])
def list_rule42(
    regatta_id: int,
    class_name: Optional[str] = Query(None),
    sail_num: Optional[str] = Query(None),
    race: Optional[str] = Query(None),
    group: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    if current_user is not None and current_user.role == "jury":
        assert_jury_regatta_access(db, current_user, regatta_id)
    q = (
        db.query(models.Rule42Record, models.Entry.boat_country_code)
        .outerjoin(
            models.Entry,
            and_(
                models.Entry.regatta_id == models.Rule42Record.regatta_id,
                models.Entry.class_name == models.Rule42Record.class_name,
                func.lower(func.trim(models.Entry.sail_number)) == func.lower(func.trim(models.Rule42Record.sail_num)),
            ),
        )
        .filter(models.Rule42Record.regatta_id == regatta_id)
    )
    if class_name:
        q = q.filter(models.Rule42Record.class_name == class_name)
    if sail_num:
        q = q.filter(models.Rule42Record.sail_num == sail_num)
    if race:
        q = q.filter(models.Rule42Record.race == race)
    if group:
        q = q.filter(models.Rule42Record.group == group)
    rows = q.order_by(models.Rule42Record.date.desc(), models.Rule42Record.id.desc()).all()
    return [
        schemas.Rule42Out(
            id=rec.id,
            regatta_id=rec.regatta_id,
            sail_num=rec.sail_num,
            boat_country_code=boat_cc,
            penalty_number=rec.penalty_number,
            race=rec.race,
            group=rec.group,
            rule=rec.rule,
            comp_action=rec.comp_action,
            description=rec.description,
            class_name=rec.class_name,
            date=rec.date,
        )
        for rec, boat_cc in rows
    ]


# ============================================
# LISTAR (NOVO) — paginado + scope=mine|all
# devolve {"items": [...], "page_info": {...}}
# ============================================
@router.get("/{regatta_id}/list", response_model=dict)
def list_rule42_paged(
    regatta_id: int,
    scope: str = Query("mine", pattern="^(mine|all)$"),
    search: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[int] = Query(None, description="Keyset cursor: último id visto"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "jury":
        assert_jury_regatta_access(db, current_user, regatta_id)

    # base (LEFT JOIN para tentar ligar à Entry)
    q = (
        db.query(models.Rule42Record, models.Entry)
        .outerjoin(
            models.Entry,
            and_(
                models.Entry.regatta_id == models.Rule42Record.regatta_id,
                models.Entry.class_name == models.Rule42Record.class_name,
                models.Entry.sail_number == models.Rule42Record.sail_num,
            ),
        )
        .filter(models.Rule42Record.regatta_id == regatta_id)
    )

    # apenas "minhas" por defeito → via entries do utilizador
    if scope == "mine":
        q = q.filter(models.Entry.user_id == current_user.id)

    # keyset cursor (ids decrescentes)
    if cursor is not None:
        q = q.filter(models.Rule42Record.id < cursor)

    # pesquisa simples
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                models.Rule42Record.sail_num.ilike(like),
                models.Rule42Record.penalty_number.ilike(like),
                models.Rule42Record.race.ilike(like),
                models.Rule42Record.group.ilike(like),
                models.Entry.boat_name.ilike(like),
            )
        )

    rows = (
        q.order_by(desc(models.Rule42Record.date), desc(models.Rule42Record.id))
         .limit(limit + 1)  # +1 para detectar se há mais
         .all()
    )

    # construir items
    items = []
    for rec, ent in rows[:limit]:
        items.append({
            "id": rec.id,
            "regatta_id": rec.regatta_id,
            "class_name": rec.class_name,
            "sail_num": rec.sail_num,
            "race": rec.race,
            "penalty_number": rec.penalty_number,
            "group": rec.group,
            "rule": rec.rule,
            "comp_action": rec.comp_action,
            "date": rec.date,
            "entry": {
                "entry_id": getattr(ent, "id", None),
                "sail_number": getattr(ent, "sail_number", None),
                "boat_name": getattr(ent, "boat_name", None),
                "skipper_name": f"{getattr(ent, 'first_name', '') or ''} {getattr(ent, 'last_name', '') or ''}".strip() or None,
                "class_name": getattr(ent, "class_name", None),
                "user_id": getattr(ent, "user_id", None),
                "club": getattr(ent, "club", None),
            } if ent else None,
        })

    has_more = len(rows) > limit
    # usar o id do "extra" como cursor seguinte (padrão keyset)
    next_cursor = rows[-1][0].id if has_more else None

    return {
        "items": items,
        "page_info": {"has_more": has_more, "next_cursor": next_cursor},
    }


# ============================================
# CRIAR (ADMIN)
# ============================================
@router.post(
    "/",
    response_model=schemas.Rule42Out,
    status_code=status.HTTP_201_CREATED,
)
def create_rule42(
    payload: schemas.Rule42Create,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    regatta = db.query(models.Regatta).filter_by(id=payload.regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    _ensure_rule42_write(db, current_user, payload.regatta_id)
    rec = models.Rule42Record(**payload.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


# ============================================
# EDITAR (ADMIN)
# ============================================
@router.patch(
    "/{id}",
    response_model=schemas.Rule42Out,
)
def update_rule42(
    id: int,
    payload: schemas.Rule42Patch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rec = db.query(models.Rule42Record).filter(models.Rule42Record.id == id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    _ensure_rule42_write(db, current_user, rec.regatta_id)

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(rec, k, v)

    db.commit()
    db.refresh(rec)
    return rec


# ============================================
# APAGAR (ADMIN)
# ============================================
@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_rule42(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rec = db.query(models.Rule42Record).filter(models.Rule42Record.id == id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    _ensure_rule42_write(db, current_user, rec.regatta_id)
    db.delete(rec)
    db.commit()
    return
