# app/routes/notices.py
from fastapi import (
    APIRouter, UploadFile, File, Form, Depends, HTTPException, Query, status
)
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from uuid import uuid4
import os

from app.database import get_db
from app import models, schemas
from app.models import NoticeSource, NoticeDocType, RegattaClass  # enums e modelo

router = APIRouter(prefix="/notices", tags=["notices"])

# caminhos de upload
UPLOAD_DIR = "uploads/notices"
PUBLIC_PREFIX = "/uploads/notices"


# ------------------------ helpers ------------------------
def ensure_upload_dir() -> None:
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def map_notice_to_read(n: models.Notice) -> schemas.NoticeRead:
    """
    Converte o modelo SQLAlchemy para o schema de resposta.
    Garante string nos enums mesmo que a ORM devolva Enum ou str.
    """
    src = n.source.value if hasattr(n.source, "value") else n.source
    dtp = n.doc_type.value if hasattr(n.doc_type, "value") else n.doc_type
    cls_names = [c.class_name for c in (n.classes or [])]

    return schemas.NoticeRead(
        id=n.id,
        filename=n.filename,
        filepath=n.filepath,
        title=n.title,
        regatta_id=n.regatta_id,
        published_at=n.published_at,
        source=src,
        doc_type=dtp,
        is_important=bool(n.is_important),
        applies_to_all=bool(n.applies_to_all),
        classes=cls_names,
    )


# ------------------------ upload ------------------------
@router.post(
    "/upload/",
    response_model=schemas.NoticeRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_notice_file(
    regatta_id: int = Form(...),
    title: str = Form(...),

    # novos metadados
    source: NoticeSource = Form(NoticeSource.OTHER),
    doc_type: NoticeDocType = Form(NoticeDocType.RACE_DOCUMENT),
    is_important: bool = Form(False),
    applies_to_all: bool = Form(True),

    # quando não for "All Classes", aceitar lista de nomes de classes da regata
    classes: Optional[List[str]] = Form(None),

    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    ensure_upload_dir()

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Só são permitidos PDFs.")

    # guarda o ficheiro com nome aleatório
    extension = file.filename.split(".")[-1]
    random_name = f"{uuid4()}.{extension}"
    system_path = os.path.join(UPLOAD_DIR, random_name)
    public_path = f"{PUBLIC_PREFIX}/{random_name}"

    with open(system_path, "wb") as buffer:
        buffer.write(file.file.read())

    # cria o Notice
    notice = models.Notice(
        filename=file.filename,
        filepath=public_path,       # caminho público
        title=title.strip(),
        regatta_id=regatta_id,
        source=source,
        doc_type=doc_type,
        is_important=is_important,
        applies_to_all=applies_to_all,
        # published_at vem via server_default
    )

    # liga a classes se não for "All Classes"
    if not applies_to_all:
        if not classes:
            raise HTTPException(
                status_code=400,
                detail="Indique as classes ou marque 'Applies to all'.",
            )
        # buscar classes válidas desta regata por nome
        found = (
            db.query(RegattaClass)
              .filter(
                  RegattaClass.regatta_id == regatta_id,
                  RegattaClass.class_name.in_(classes),
              )
              .all()
        )
        valid_names = {c.class_name for c in found}
        missing = [name for name in set(classes) if name not in valid_names]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Classes inválidas para esta regata: {missing}",
            )
        notice.classes = found

    db.add(notice)
    db.commit()
    db.refresh(notice)

    return map_notice_to_read(notice)


# ------------------------ listagem com filtros ------------------------
@router.get(
    "/{regatta_id}",
    response_model=List[schemas.NoticeRead],
)
def get_notices_by_regatta(
    regatta_id: int,
    db: Session = Depends(get_db),

    # filtros
    class_name: Optional[str] = Query(None, description="Filtra por classe (ex.: 49er)"),
    doc_type: Optional[NoticeDocType] = Query(None),
    important: Optional[bool] = Query(None),
    only_all_classes: Optional[bool] = Query(None),

    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """
    Lista notices de uma regata, ordenado por published_at DESC.
    - Filtra por doc_type, importante, 'apenas All Classes' e/ou class_name.
    - Para class_name, traz os que se aplicam à classe OU são 'All'.
    """
    q = db.query(models.Notice).filter(models.Notice.regatta_id == regatta_id)

    if doc_type is not None:
        q = q.filter(models.Notice.doc_type == doc_type)

    if important is not None:
        q = q.filter(models.Notice.is_important == important)

    if only_all_classes is True:
        q = q.filter(models.Notice.applies_to_all.is_(True))

    if class_name:
        # join ao M2M; inclui também os "All Classes"
        q = (
            q.outerjoin(
                models.notice_classes,
                models.notice_classes.c.notice_id == models.Notice.id,
            )
            .outerjoin(
                models.RegattaClass,
                models.RegattaClass.id == models.notice_classes.c.regatta_class_id,
            )
            .filter(
                (models.Notice.applies_to_all.is_(True))
                | (models.RegattaClass.class_name == class_name)
            )
        )

    rows = (
        q.order_by(desc(models.Notice.published_at))
         .offset(offset)
         .limit(limit)
         .all()
    )
    return [map_notice_to_read(n) for n in rows]


# ------------------------ detalhe ------------------------
@router.get("/detail/{notice_id}", response_model=schemas.NoticeRead)
def get_notice_detail(notice_id: int, db: Session = Depends(get_db)):
    n = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return map_notice_to_read(n)


# ------------------------ delete ------------------------
@router.delete("/{notice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notice(notice_id: int, db: Session = Depends(get_db)):
    n = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    # apaga ficheiro do sistema (mapeia caminho público -> pasta local)
    fs_path = n.filepath.replace("/uploads", "uploads")
    if os.path.exists(fs_path):
        try:
            os.remove(fs_path)
        except Exception:
            # não bloquear remoção do registo se o ficheiro já não existir
            pass

    db.delete(n)
    db.commit()
    return


# ------------------------ PATCH: important ------------------------
class ImportantPatch(BaseModel):
    is_important: bool


@router.patch("/{notice_id}/important", response_model=schemas.NoticeRead, status_code=status.HTTP_200_OK)
def set_notice_important(
    notice_id: int,
    payload: ImportantPatch,
    db: Session = Depends(get_db),
):
    """
    Atualiza o estado de destaque (is_important) de um notice.
    Usado pelo AdminNoticeTable no frontend.
    """
    n = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    n.is_important = bool(payload.is_important)
    db.commit()
    db.refresh(n)
    return map_notice_to_read(n)


from fastapi.responses import FileResponse

@router.get("/{notice_id}/download")
def download_notice(notice_id: int, db: Session = Depends(get_db)):
    n = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    # mapeia caminho público -> caminho no disco (pasta uploads/)
    fs_path = n.filepath.replace("/uploads", "uploads")
    if not os.path.exists(fs_path):
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")

    # força download com o nome original
    return FileResponse(
        fs_path,
        media_type="application/pdf",
        filename=n.filename,
    )
