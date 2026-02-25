# app/routes/news.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user, verify_role

router = APIRouter(prefix="/news", tags=["news"])


# ---------- Público: listar e ver uma notícia ----------
@router.get("/", response_model=List[schemas.NewsItemRead])
def list_news(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Lista as notícias mais recentes (ordenadas por published_at descendente)."""
    q = (
        db.query(models.NewsItem)
        .order_by(desc(models.NewsItem.published_at))
        .offset(offset)
        .limit(limit)
    )
    return q.all()


@router.get("/{news_id}", response_model=schemas.NewsItemRead)
def get_news(news_id: int, db: Session = Depends(get_db)):
    """Detalhe de uma notícia (público)."""
    item = db.query(models.NewsItem).filter(models.NewsItem.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="News not found")
    return item


# ---------- Admin: CRUD ----------
@router.post("/", response_model=schemas.NewsItemRead, status_code=status.HTTP_201_CREATED)
def create_news(
    body: schemas.NewsItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    """Criar uma nova notícia (apenas admin)."""
    now = datetime.now(timezone.utc)
    item = models.NewsItem(
        title=body.title.strip(),
        published_at=body.published_at or now,
        excerpt=body.excerpt.strip() if body.excerpt else None,
        body=body.body.strip() if body.body else None,
        image_url=body.image_url.strip() if body.image_url else None,
        category=body.category.strip() if body.category else None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{news_id}", response_model=schemas.NewsItemRead)
def update_news(
    news_id: int,
    body: schemas.NewsItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    """Atualizar uma notícia (apenas admin)."""
    item = db.query(models.NewsItem).filter(models.NewsItem.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="News not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if v is not None and k in ("title", "excerpt", "body", "image_url", "category"):
            setattr(item, k, v.strip() if isinstance(v, str) else v)
        elif k == "published_at":
            setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_news(
    news_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    """Eliminar uma notícia (apenas admin)."""
    item = db.query(models.NewsItem).filter(models.NewsItem.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="News not found")
    db.delete(item)
    db.commit()
    return None
