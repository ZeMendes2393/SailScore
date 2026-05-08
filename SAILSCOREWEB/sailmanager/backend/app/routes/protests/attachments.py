from __future__ import annotations

import os
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Protest, ProtestAttachment
from app.storage_uploads import save_binary_upload
from utils.auth_utils import get_current_user, verify_role
from utils.guards import ensure_regatta_scope
from .helpers import normalize_public_url

router = APIRouter()

@router.get("/{protest_id}/attachments")
def list_attachments(
    regatta_id: int,
    protest_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
    __=Depends(ensure_regatta_scope),
):
    rows = (
        db.query(ProtestAttachment)
        .filter(ProtestAttachment.protest_id == protest_id)
        .order_by(ProtestAttachment.created_at.asc())
        .all()
    )
    return [
        {
            "id": a.id,
            "kind": a.kind,
            "filename": a.filename,
            "url": a.url,
            "content_type": a.content_type,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in rows
    ]

@router.post("/{protest_id}/attachments", dependencies=[Depends(verify_role(["admin", "jury"]))])
def upload_attachment(
    regatta_id: int,
    protest_id: int,
    kind: str = Form("admin_upload"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(ensure_regatta_scope),
):
    exists = (
        db.query(Protest.id)
        .filter(Protest.id == protest_id, Protest.regatta_id == regatta_id)
        .first()
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Protest not found")

    safe_name = os.path.basename(file.filename or "upload.bin")
    content = file.file.read()
    stored_url = save_binary_upload(
        subdir=f"protests/{regatta_id}/{protest_id}",
        filename=safe_name,
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )
    public_url = normalize_public_url(stored_url)

    a = ProtestAttachment(
        protest_id=protest_id,
        kind=kind,
        filename=safe_name,
        content_type=file.content_type or "application/octet-stream",
        size=len(content),
        url=public_url,
        uploaded_by_user_id=current_user.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"id": a.id, "url": a.url}
