from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import uuid4
import os
from datetime import datetime

from app.database import get_db
from app import models, schemas


import mimetypes


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
        url=a.public_path,  # URL público servido por StaticFiles
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
# top of file


@router.post("/{entry_id}/attachments", response_model=schemas.EntryAttachmentRead, status_code=status.HTTP_201_CREATED)
def upload_attachment(
    entry_id: int,
    title: str = Form(...),
    visible_to_sailor: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # só PDF
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    # paths
    entry_dir = os.path.join(BASE_UPLOAD_DIR, str(entry_id))
    ensure_dir(entry_dir)

    # mantém a extensão original
    orig_name = os.path.basename(file.filename)
    _, ext = os.path.splitext(orig_name)           # e.g. ".pdf"
    rand_name = f"{uuid4()}{ext or ''}"            # uuid + .pdf
    storage_path = os.path.join(entry_dir, rand_name)
    public_path = f"{BASE_PUBLIC_PREFIX}/{entry_id}/{rand_name}"

    with open(storage_path, "wb") as fh:
        fh.write(file.file.read())

    size = os.path.getsize(storage_path) if os.path.exists(storage_path) else 0

    # content-type correto
    content_type = file.content_type or mimetypes.guess_type(rand_name)[0] or "application/octet-stream"

    att = models.EntryAttachment(
        entry_id=entry_id,
        title=title.strip(),
        content_type=content_type,
        size_bytes=size,
        visible_to_sailor=bool(visible_to_sailor),
        original_filename=orig_name,   # 👈 guarda o nome original COM extensão
        storage_path=storage_path,
        public_path=public_path,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return map_read(att)


# ---------- PATCH ----------
# NOVO caminho com entry_id (o que o FE espera)
@router.patch("/{entry_id}/attachments/{attachment_id}", response_model=schemas.EntryAttachmentRead)
def patch_attachment_scoped(entry_id: int, attachment_id: int, payload: schemas.EntryAttachmentPatch, db: Session = Depends(get_db)):
    a = (
        db.query(models.EntryAttachment)
          .filter(models.EntryAttachment.id == attachment_id, models.EntryAttachment.entry_id == entry_id)
          .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if payload.title is not None:
        a.title = payload.title.strip() or a.title
    if payload.visible_to_sailor is not None:
        a.visible_to_sailor = bool(payload.visible_to_sailor)
    a.updated_at = datetime.utcnow()
    db.commit(); db.refresh(a)
    return map_read(a)

# Mantém rota antiga (retrocompatibilidade)
@router.patch("/attachments/{attachment_id}", response_model=schemas.EntryAttachmentRead)
def patch_attachment_legacy(attachment_id: int, payload: schemas.EntryAttachmentPatch, db: Session = Depends(get_db)):
    a = db.query(models.EntryAttachment).filter(models.EntryAttachment.id == attachment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if payload.title is not None:
        a.title = payload.title.strip() or a.title
    if payload.visible_to_sailor is not None:
        a.visible_to_sailor = bool(payload.visible_to_sailor)
    a.updated_at = datetime.utcnow()
    db.commit(); db.refresh(a)
    return map_read(a)

# ---------- DELETE ----------
# NOVO caminho com entry_id (o que o FE espera)
@router.delete("/{entry_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment_scoped(entry_id: int, attachment_id: int, db: Session = Depends(get_db)):
    a = (
        db.query(models.EntryAttachment)
          .filter(models.EntryAttachment.id == attachment_id, models.EntryAttachment.entry_id == entry_id)
          .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    try:
        if a.storage_path and os.path.exists(a.storage_path):
            os.remove(a.storage_path)
    except Exception:
        pass
    db.delete(a); db.commit()
    return

# Mantém rota antiga (retrocompatibilidade)
@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment_legacy(attachment_id: int, db: Session = Depends(get_db)):
    a = db.query(models.EntryAttachment).filter(models.EntryAttachment.id == attachment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    try:
        if a.storage_path and os.path.exists(a.storage_path):
            os.remove(a.storage_path)
    except Exception:
        pass
    db.delete(a); db.commit()
    return

# ---------- DOWNLOAD ----------
# NOVO caminho com entry_id (o que o FE espera)

@router.get("/{entry_id}/attachments/{attachment_id}/download")
def download_attachment_scoped(entry_id: int, attachment_id: int, db: Session = Depends(get_db)):
    a = (
        db.query(models.EntryAttachment)
          .filter(models.EntryAttachment.id == attachment_id,
                  models.EntryAttachment.entry_id == entry_id)
          .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if not a.storage_path or not os.path.exists(a.storage_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Nome de download: prefere o original; senão, usa o título + .pdf
    safe_name = (a.original_filename or "").strip()
    if not safe_name:
        base = (a.title or "document").replace("/", "_")
        safe_name = f"{base}.pdf"

    return FileResponse(
        a.storage_path,
        media_type=a.content_type or "application/pdf",
        filename=safe_name,  # 👈 força extensão no nome que o browser grava
    )


# Mantém rota antiga (retrocompatibilidade)
@router.get("/attachments/{attachment_id}/download")
def download_attachment_legacy(attachment_id: int, db: Session = Depends(get_db)):
    a = db.query(models.EntryAttachment).filter(models.EntryAttachment.id == attachment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if not os.path.exists(a.storage_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        a.storage_path,
        media_type=a.content_type or "application/pdf",
        filename=(a.title or a.original_filename or "document.pdf").replace("/", "_"),
    )
