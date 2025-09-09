# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute
import os

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
    rule42,    # ← NOVO
    hearings,  # ← NOVO
)

app = FastAPI(title="SailScore API")

# ---------- CORS ----------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Startup: garantir pastas de upload ----------
@app.on_event("startup")
def _ensure_upload_dirs():
    os.makedirs("uploads/notices", exist_ok=True)

# ---------- BD ----------
# Se create_database só garante o ficheiro/engine, mantém. Para schema usa Alembic.
create_database()

# ---------- Routers ----------
# Cada router já tem prefixo no próprio ficheiro.
app.include_router(auth.router)
app.include_router(regattas.router)
app.include_router(entries.router)
app.include_router(notices.router)          # prefix="/notices"
app.include_router(results.router)
app.include_router(races.router)
app.include_router(regatta_classes.router)
app.include_router(protests.router)
app.include_router(rule42.router)           # prefix="/rule42"
app.include_router(hearings.router)         # prefix="/hearings"

# ---------- Utilitários ----------
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/_debug/routes")
def _debug_routes():
    return [
        {"path": r.path, "methods": sorted(list(r.methods)), "name": r.name}
        for r in app.routes if isinstance(r, APIRoute)
    ]

def custom_openapi():
    schema = get_openapi(
        title=app.title,
        version="1.0.0",
        description="SailScore API",
        routes=app.routes,
    )
    return schema

app.openapi = custom_openapi
app.openapi_schema = None

# ---------- Ficheiros estáticos ----------
# Serve /uploads/** (p.ex., PDFs de notices)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
