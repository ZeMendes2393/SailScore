from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import uuid4
import os
from datetime import datetime

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/entries", tags=["entry_attachments"])

# storage local
BASE_UPLOAD_DIR = "uploads/entry_attachments"      # disco
BASE_PUBLIC_PREFIX = "/uploads/entry_attachments"  # url pública (static)

def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)

def map_read(a: models.EntryAttachment) -> schemas.EntryAttachmentRead:
    return schemas.EntryAttachmentRead(
        id=a.id,
        entry_id=a.entry_id,
        title=a.title,
        url=a.public_path,  # devolvemos URL público (ou signed URL se usares S3)
        content_type=a.content_type,
        size_bytes=int(a.size_bytes or 0),
        visible_to_sailor=bool(a.visible_to_sailor),
        uploaded_by_name=a.uploaded_by_name,
        created_at=a.created_at.isoformat() if a.created_at else "",
        updated_at=a.updated_at.isoformat() if a.updated_at else None,
    )

# ---------- LIST ----------
@router.get("/{entry_id}/attachments", response_model=List[schemas.EntryAttachmentRead])
def list_attachments(entry_id: int, db: Session = Depends(get_db), only_visible: Optional[bool] = None):
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    q = db.query(models.EntryAttachment).filter(models.EntryAttachment.entry_id == entry_id)
    if only_visible is True:
        q = q.filter(models.EntryAttachment.visible_to_sailor.is_(True))
    rows = q.order_by(models.EntryAttachment.created_at.desc()).all()
    return [map_read(a) for a in rows]

# ---------- UPLOAD ----------
@router.post("/{entry_id}/attachments", response_model=schemas.EntryAttachmentRead, status_code=status.HTTP_201_CREATED)
def upload_attachment(
    entry_id: int,
    title: str = Form(...),
    visible_to_sailor: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    # current_user: models.User = Depends(get_current_user)  # se tiveres auth
):
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # validação (só admin aqui; adapta à tua auth)
    # if current_user.role != "admin":
    #     raise HTTPException(status_code=403, detail="Only admins can upload attachments.")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    # paths
    entry_dir = os.path.join(BASE_UPLOAD_DIR, str(entry_id))
    ensure_dir(entry_dir)

    ext = file.filename.split(".")[-1].lower()
    random_name = f"{uuid4()}.{ext}"
    storage_path = os.path.join(entry_dir, random_name)
    public_path = f"{BASE_PUBLIC_PREFIX}/{entry_id}/{random_name}"

    with open(storage_path, "wb") as fh:
        fh.write(file.file.read())

    size = os.path.getsize(storage_path) if os.path.exists(storage_path) else 0

    att = models.EntryAttachment(
        entry_id=entry_id,
        title=title.strip(),
        content_type="application/pdf",
        size_bytes=size,
        visible_to_sailor=bool(visible_to_sailor),
        original_filename=file.filename,
        storage_path=storage_path,
        public_path=public_path,
        # uploaded_by_id=current_user.id,
        # uploaded_by_name=current_user.email,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return map_read(att)

# ---------- PATCH ----------
@router.patch("/attachments/{attachment_id}", response_model=schemas.EntryAttachmentRead)
def patch_attachment(attachment_id: int, payload: schemas.EntryAttachmentPatch, db: Session = Depends(get_db)):
    a = db.query(models.EntryAttachment).filter(models.EntryAttachment.id == attachment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # validação (só admin)
    # ...

    if payload.title is not None:
        a.title = payload.title.strip() or a.title
    if payload.visible_to_sailor is not None:
        a.visible_to_sailor = bool(payload.visible_to_sailor)
    a.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(a)
    return map_read(a)

# ---------- DELETE ----------
@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(attachment_id: int, db: Session = Depends(get_db)):
    a = db.query(models.EntryAttachment).filter(models.EntryAttachment.id == attachment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # validação (só admin)
    # ...

    try:
        if a.storage_path and os.path.exists(a.storage_path):
            os.remove(a.storage_path)
    except Exception:
        pass

    db.delete(a)
    db.commit()
    return

# ---------- DOWNLOAD FORÇADO (opcional) ----------
@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: int, db: Session = Depends(get_db)):
    a = db.query(models.EntryAttachment).filter(models.EntryAttachment.id == attachment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if not os.path.exists(a.storage_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        a.storage_path,
        media_type="application/pdf",
        filename=a.original_filename or "document.pdf",
    )
