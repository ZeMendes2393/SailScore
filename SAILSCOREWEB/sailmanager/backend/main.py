# app/main.py
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute

from app.database import create_database
from app.routes import (
    auth,
    regattas,
    entries,
    notices,
    results,
    races,
    regatta_classes,
    protests,
    rule42,
    hearings,
    protest_time_limit,  # 👈 PTL
)

app = FastAPI(title="SailScore API")

# ---------- CORS ----------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

# Permite acrescentar origens via env (separadas por vírgulas)
# Ex.: ALLOWED_ORIGINS="https://dev.sailscore.pt,https://staging.sailscore.pt"
extra_origins = os.getenv("ALLOWED_ORIGINS")
if extra_origins:
    for o in [x.strip() for x in extra_origins.split(",") if x.strip()]:
        if o not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # usa lista explícita quando allow_credentials=True
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Paths base ----------
UPLOADS_DIR = Path("uploads").resolve()
MEDIA_DIR = Path("media").resolve()
FILES_DIR = Path("files").resolve()
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
FILES_DIR.mkdir(parents=True, exist_ok=True)

# ---------- Startup ----------
@app.on_event("startup")
def _ensure_upload_dirs():
    (UPLOADS_DIR / "notices").mkdir(parents=True, exist_ok=True)
    (MEDIA_DIR / "protests").mkdir(parents=True, exist_ok=True)
    (FILES_DIR / "protests").mkdir(parents=True, exist_ok=True)

# Inicializa DB (dev)
create_database()

# ---------- Routers ----------
app.include_router(auth.router)
app.include_router(regattas.router)
app.include_router(entries.router, prefix="/entries", tags=["entries"])
app.include_router(notices.router)
app.include_router(results.router)
app.include_router(races.router)
app.include_router(regatta_classes.router)
app.include_router(protests.router)
app.include_router(rule42.router)
app.include_router(hearings.router)
app.include_router(protest_time_limit.router)  # 👈 PTL

# ---------- Utilitários ----------
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/_debug/routes")
def _debug_routes():
    return [
        {"path": r.path, "methods": sorted(list(r.methods)), "name": r.name}
        for r in app.routes
        if isinstance(r, APIRoute)
    ]

def custom_openapi():
    return get_openapi(
        title=app.title,
        version="1.0.0",
        description="SailScore API",
        routes=app.routes,
    )

app.openapi = custom_openapi
app.openapi_schema = None

# ---------- Ficheiros estáticos ----------
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")
app.mount("/files", StaticFiles(directory=str(FILES_DIR)), name="files")
