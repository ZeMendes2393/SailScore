from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user, get_current_user_optional

router = APIRouter(prefix="/regattas/{regatta_id}/questions", tags=["questions"])

def _next_seq_for_regatta(db: Session, regatta_id: int) -> int:
    res = db.execute(
        select(func.coalesce(func.max(models.Question.seq_no), 0)).where(models.Question.regatta_id == regatta_id)
    )
    return (res.scalar() or 0) + 1

@router.get("", response_model=List[schemas.QuestionRead])
def list_questions(
    regatta_id: int,
    status_: Optional[schemas.QuestionStatus] = Query(None, alias="status"),
    q_text: Optional[str] = Query(None, description="search in subject/body"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    """
    Regras:
    - Visitante (sem token): vê apenas PUBLIC.
    - Sailor autenticado (não-admin): vê apenas as SUAS (created_by == user.id).
    - Admin: vê todas.
    """
    q = db.query(models.Question).filter(models.Question.regatta_id == regatta_id)

    # Visitante → só públicas
    if current_user is None:
        q = q.filter(models.Question.visibility == models.QuestionVisibility.public)

    # Autenticado não-admin → apenas as dele
    elif current_user.role != "admin":
        q = q.filter(models.Question.created_by == current_user.id)

    # Filtros comuns
    if status_:
        q = q.filter(models.Question.status == status_)
    if q_text:
        s = f"%{q_text.strip()}%"
        q = q.filter(or_(models.Question.subject.ilike(s), models.Question.body.ilike(s)))

    return q.order_by(models.Question.seq_no.asc()).all()

@router.get("/{question_id}", response_model=schemas.QuestionRead)
def get_question(
    regatta_id: int,
    question_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    q = db.query(models.Question).filter_by(id=question_id, regatta_id=regatta_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    # Visitante só pode ver públicas
    if current_user is None:
        if q.visibility != models.QuestionVisibility.public:
            raise HTTPException(status_code=403, detail="Not authorized")
        return q

    # Autenticado não-admin -> só as dele; admin vê tudo
    if current_user.role != "admin" and q.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return q

@router.post("", response_model=schemas.QuestionRead, status_code=status.HTTP_201_CREATED)
def create_question(
    regatta_id: int,
    payload: schemas.QuestionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    seq = _next_seq_for_regatta(db, regatta_id)

    q = models.Question(
        regatta_id=regatta_id,
        seq_no=seq,
        class_name=payload.class_name.strip(),
        sail_number=payload.sail_number.strip(),
        sailor_name=payload.sailor_name.strip(),
        subject=payload.subject.strip(),
        body=payload.body.strip(),
        # força sempre público (alinha com FE e com Notice Board público)
        visibility=models.QuestionVisibility.public,
        status=models.QuestionStatus.open,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
    )

    db.add(q)
    db.commit()
    db.refresh(q)
    return q

@router.patch("/{question_id}", response_model=schemas.QuestionRead)
def update_question(
    regatta_id: int,
    question_id: int,
    payload: schemas.QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Question).filter_by(id=question_id, regatta_id=regatta_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    is_admin = current_user.role == "admin"
    is_author = q.created_by == current_user.id

    if not is_admin:
        if not is_author:
            raise HTTPException(status_code=403, detail="Not authorized")
        if q.status != models.QuestionStatus.open or q.answer_text:
            raise HTTPException(status_code=400, detail="Edition not allowed anymore")

    data = payload.model_dump(exclude_unset=True)

    # Autor só pode mexer subject/body; admin pode também status/answer (ignorar visibility)
    if is_admin:
        if "subject" in data: q.subject = data["subject"].strip()
        if "body" in data: q.body = data["body"].strip()
        if "answer_text" in data:
            q.answer_text = (data["answer_text"] or "").strip() or None
            if q.answer_text and q.status == models.QuestionStatus.open:
                q.status = models.QuestionStatus.answered
        if "status" in data:
            q.status = data["status"]
    else:
        if "subject" in data: q.subject = data["subject"].strip()
        if "body" in data: q.body = data["body"].strip()
        # ignora answer/status/visibility do lado do autor

    db.commit()
    db.refresh(q)
    return q
