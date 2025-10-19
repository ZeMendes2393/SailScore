# app/routes/requests.py
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app import models, schemas
from utils.auth_utils import get_current_user, get_current_user_optional  # 👈 opcional + obrigatório

router = APIRouter(prefix="/regattas/{regatta_id}/requests", tags=["requests"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _next_request_no(db: Session, regatta_id: int) -> int:
    """
    Usa regatta_counters.request_seq para gerar numeração sequencial por regata.
    Nota: em SQLite, with_for_update é ignorado; em Postgres funciona como esperado.
    """
    rc = (
        db.query(models.RegattaCounter)
        .filter(models.RegattaCounter.regatta_id == regatta_id)
        .with_for_update(nowait=False)
        .first()
    )
    if not rc:
        rc = models.RegattaCounter(regatta_id=regatta_id, request_seq=0)
        db.add(rc)
        db.flush()
    rc.request_seq += 1
    db.flush()
    return rc.request_seq


@router.get("", response_model=List[schemas.RequestRead])
def list_requests(
    regatta_id: int,
    status_q: Optional[str] = Query("all", description="all | open | closed"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    q = db.query(models.Request).filter(models.Request.regatta_id == regatta_id)

    # Público (sem token ou token inválido) → agora pode ver TODOS, respeitando status_q
    if current_user is None:
        if status_q and status_q != "all":
            if status_q == "open":
                q = q.filter(models.Request.status.in_(("submitted", "under_review")))
            elif status_q == "closed":
                q = q.filter(models.Request.status == "closed")
        if search:
            s = f"%{search.strip().lower()}%"
            q = q.filter(
                or_(
                    func.lower(func.coalesce(models.Request.sail_number, "")).like(s),
                    func.lower(func.coalesce(models.Request.class_name, "")).like(s),
                    func.lower(func.coalesce(models.Request.sailor_name, "")).like(s),
                    func.lower(models.Request.request_text).like(s),
                    func.lower(func.coalesce(models.Request.admin_response, "")).like(s),
                )
            )
        return q.order_by(models.Request.request_no.asc()).all()

    # (resto mantém igual para utilizadores autenticados)
    if current_user.role != "admin":
        my_entries = (
            db.query(models.Entry.id)
            .filter(models.Entry.regatta_id == regatta_id)
            .filter(
                or_(
                    models.Entry.user_id == current_user.id,
                    func.lower(models.Entry.email) == func.lower(current_user.email),
                )
            )
        )
        q = q.filter(models.Request.initiator_entry_id.in_(my_entries.subquery()))

    if status_q and status_q != "all":
        if status_q == "open":
            q = q.filter(models.Request.status.in_(("submitted", "under_review")))
        elif status_q == "closed":
            q = q.filter(models.Request.status == "closed")

    if search:
        s = f"%{search.strip().lower()}%"
        q = q.filter(
            or_(
                func.lower(func.coalesce(models.Request.sail_number, "")).like(s),
                func.lower(func.coalesce(models.Request.class_name, "")).like(s),
                func.lower(func.coalesce(models.Request.sailor_name, "")).like(s),
                func.lower(models.Request.request_text).like(s),
                func.lower(func.coalesce(models.Request.admin_response, "")).like(s),
            )
        )

    return q.order_by(models.Request.request_no.asc()).all()


@router.get("/{request_id}", response_model=schemas.RequestRead)
def get_request(
    regatta_id: int,
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    r = db.query(models.Request).filter_by(id=request_id, regatta_id=regatta_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")

    if current_user.role != "admin":
        # bloquear se não for do utilizador
        en = db.query(models.Entry).filter(models.Entry.id == r.initiator_entry_id).first()
        if not en or not (
            en.user_id == current_user.id
            or (en.email or "").lower() == (current_user.email or "").lower()
        ):
            raise HTTPException(status_code=403, detail="Acesso negado")
    return r


@router.post("", response_model=schemas.RequestRead, status_code=status.HTTP_201_CREATED)
def create_request(
    regatta_id: int,
    body: schemas.RequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # valida entry do sailor
    en = db.query(models.Entry).filter(models.Entry.id == body.initiator_entry_id).first()
    if not en or en.regatta_id != regatta_id:
        raise HTTPException(status_code=400, detail="Entry inválida para esta regata")

    # só o próprio (ou admin) pode criar
    if current_user.role != "admin":
        if not (
            en.user_id == current_user.id
            or (en.email or "").lower() == (current_user.email or "").lower()
        ):
            raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        request_no = _next_request_no(db, regatta_id)
        sailor_name = f"{(en.first_name or '').strip()} {(en.last_name or '').strip()}".strip() or (en.email or "")

        r = models.Request(
            regatta_id=regatta_id,
            initiator_entry_id=en.id,
            class_name=en.class_name,
            sail_number=en.sail_number,
            sailor_name=sailor_name,
            request_text=body.request_text.strip(),
            status="submitted",
            request_no=request_no,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        return r
    except Exception:
        db.rollback()
        raise


@router.patch("/{request_id}", response_model=schemas.RequestRead)
def patch_request(
    regatta_id: int,
    request_id: int,
    body: schemas.RequestPatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    r = db.query(models.Request).filter_by(id=request_id, regatta_id=regatta_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")

    if current_user.role == "admin":
        # admin pode editar status e admin_response
        allowed = {"status", "admin_response"}
        for k, v in body.model_dump(exclude_unset=True).items():
            if k in allowed:
                setattr(r, k, v)
        db.commit()
        db.refresh(r)
        return r

    # sailor: pode editar request_text se ainda submitted
    en = db.query(models.Entry).filter(models.Entry.id == r.initiator_entry_id).first()
    if not en or not (
        en.user_id == current_user.id
        or (en.email or "").lower() == (current_user.email or "").lower()
    ):
        raise HTTPException(status_code=403, detail="Acesso negado")

    if r.status != "submitted":
        raise HTTPException(status_code=400, detail="Já não é possível editar este pedido.")

    if body.request_text is not None:
        r.request_text = body.request_text.strip()
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{request_id}", status_code=204)
def delete_request(
    regatta_id: int,
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    r = db.query(models.Request).filter_by(id=request_id, regatta_id=regatta_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    db.delete(r)
    db.commit()
    return
