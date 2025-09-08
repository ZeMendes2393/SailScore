# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute
import os

from app.database import create_database  # mantém se isto apenas garante o ficheiro/engine
from app.routes import (
    regattas, entries, auth, notices, results, races, regatta_classes, protests
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
# 👍 Se o teu create_database só cria o ficheiro/conexão, deixa.
# ⚠️ Se fizer Base.metadata.create_all(), o recomendado é usar Alembic para schema.
create_database()

# ---------- Routers ----------
# IMPORTANTE: estes routers já costumam ter prefixo definido *dentro* de cada ficheiro.
# Inclui sem 'prefix=' aqui para evitar duplicações tipo /notices/notices.
app.include_router(auth.router)
app.include_router(regattas.router)
app.include_router(entries.router)
app.include_router(notices.router)          # já tem prefix="/notices" no ficheiro
app.include_router(results.router)
app.include_router(races.router)
app.include_router(regatta_classes.router)  # já tem prefix dentro do ficheiro
app.include_router(protests.router)         # idem (p.ex. /regattas/{id}/protests)

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
# Serve /uploads/** (por ex. PDFs de notices)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
