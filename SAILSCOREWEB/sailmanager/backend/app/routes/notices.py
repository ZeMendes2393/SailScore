from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
import os
from uuid import uuid4
from typing import List
from fastapi import status

router = APIRouter()

UPLOAD_DIR = "uploads/notices"

@router.post("/upload/")
def upload_notice_file(
    regatta_id: int = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    extension = file.filename.split(".")[-1]
    filename = f"{uuid4()}.{extension}"
    system_path = os.path.join(UPLOAD_DIR, filename)
    public_path = f"/uploads/notices/{filename}"

    with open(system_path, "wb") as buffer:
        buffer.write(file.file.read())

    new_notice = models.Notice(
        filename=file.filename,
        filepath=public_path,  # caminho público para download
        title=title,
        regatta_id=regatta_id
    )
    db.add(new_notice)
    db.commit()
    db.refresh(new_notice)

    return {"message": "Ficheiro enviado com sucesso", "id": new_notice.id}


@router.get("/{regatta_id}")
def get_notices_by_regatta(regatta_id: int, db: Session = Depends(get_db)):
    notices = db.query(models.Notice).filter(models.Notice.regatta_id == regatta_id).all()
    return notices


@router.delete("/{notice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notice(notice_id: int, db: Session = Depends(get_db)):
    notice = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    # Apagar o ficheiro do sistema
    if os.path.exists(notice.filepath.replace("/uploads", "uploads")):
        os.remove(notice.filepath.replace("/uploads", "uploads"))

    db.delete(notice)
    db.commit()
    return

