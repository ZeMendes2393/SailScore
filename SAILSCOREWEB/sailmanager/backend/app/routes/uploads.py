from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette import status

from app.storage_uploads import save_image_upload, use_s3
from utils.auth_utils import verify_role

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOADS_DIR = Path("uploads").resolve()
NEWS_DIR = UPLOADS_DIR / "news"
REGATTAS_DIR = UPLOADS_DIR / "regattas"
SPONSORS_DIR = UPLOADS_DIR / "sponsors"
HOMEPAGE_DIR = UPLOADS_DIR / "homepage"
HEADER_DIR = UPLOADS_DIR / "header"
if not use_s3():
    NEWS_DIR.mkdir(parents=True, exist_ok=True)
    REGATTAS_DIR.mkdir(parents=True, exist_ok=True)
    SPONSORS_DIR.mkdir(parents=True, exist_ok=True)
    HOMEPAGE_DIR.mkdir(parents=True, exist_ok=True)
    HEADER_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED = {"image/jpeg", "image/png", "image/webp"}
MAX_MB = 6


@router.post("/regattas", status_code=status.HTTP_201_CREATED)
async def upload_regatta_image(
    file: UploadFile = File(...),
    current_user=Depends(verify_role(["admin"])),
):
    """Upload de imagem para regattas (header/hero)."""
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPG/PNG/WebP.")
    content = await file.read()
    if len(content) > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_MB}MB.")
    ext = ".jpg" if file.content_type == "image/jpeg" else ".png" if file.content_type == "image/png" else ".webp"
    filename = f"{uuid4().hex}{ext}"
    url = save_image_upload("regattas", filename, content, file.content_type)
    return {"url": url}


@router.post("/sponsors", status_code=status.HTTP_201_CREATED)
async def upload_sponsor_image(
    file: UploadFile = File(...),
    current_user=Depends(verify_role(["admin"])),
):
    """Upload de imagem para sponsors/apoios."""
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPG/PNG/WebP.")
    content = await file.read()
    if len(content) > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_MB}MB.")
    ext = ".jpg" if file.content_type == "image/jpeg" else ".png" if file.content_type == "image/png" else ".webp"
    filename = f"{uuid4().hex}{ext}"
    url = save_image_upload("sponsors", filename, content, file.content_type)
    return {"url": url}


@router.post("/news", status_code=status.HTTP_201_CREATED)
async def upload_news_image(
    file: UploadFile = File(...),
    current_user=Depends(verify_role(["admin"])),
):
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPG/PNG/WebP.")

    content = await file.read()
    if len(content) > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_MB}MB.")

    ext = ".jpg" if file.content_type == "image/jpeg" else ".png" if file.content_type == "image/png" else ".webp"
    filename = f"{uuid4().hex}{ext}"
    url = save_image_upload("news", filename, content, file.content_type)
    return {"url": url}


@router.post("/homepage", status_code=status.HTTP_201_CREATED)
async def upload_homepage_image(
    file: UploadFile = File(...),
    current_user=Depends(verify_role(["admin"])),
):
    """Upload de imagem para a hero da homepage do site (até 3, com ponto focal)."""
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPG/PNG/WebP.")
    content = await file.read()
    if len(content) > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_MB}MB.")
    ext = ".jpg" if file.content_type == "image/jpeg" else ".png" if file.content_type == "image/png" else ".webp"
    filename = f"{uuid4().hex}{ext}"
    url = save_image_upload("homepage", filename, content, file.content_type)
    return {"url": url}


@router.post("/header", status_code=status.HTTP_201_CREATED)
async def upload_header_image(
    file: UploadFile = File(...),
    current_user=Depends(verify_role(["admin"])),
):
    """Upload club logo image for the site header."""
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPG/PNG/WebP.")
    content = await file.read()
    if len(content) > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_MB}MB.")
    ext = ".jpg" if file.content_type == "image/jpeg" else ".png" if file.content_type == "image/png" else ".webp"
    filename = f"{uuid4().hex}{ext}"
    url = save_image_upload("header", filename, content, file.content_type)
    return {"url": url}