# app/main.py
from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute

from app import schemas
from app.database import create_database
from app.routes import (
    auth,
    metadata_routes,
    organizations,
    regattas,
    regatta_jury,
    regatta_sponsors,
    entries,
    notices,
    results,
    races,
    regatta_classes,
    protests,
    rule42,
    hearings,
    protest_time_limit,
    scoring as scoring_routes,
    entry_attachments,
    class_settings,
    discards,
    publication,
    news,
    uploads,
    design,
    global_settings as global_settings_routes,
)
from app.routes import marketing
from app.routes.discards import router as discard_router
from app.services.email import start_email_outbox_worker, process_email_outbox

from app.routes import requests as requests_routes
from app.routes import questions as questions_module
from app.routes.questions import router as questions_router
from app.routes import fleets as fleets_router
from app.routes.public_fleets import router as public_fleets_router
from app.routes.regatta_finances import router as regatta_finances_router

# docs_url="/swagger": liberta GET /docs para healthcheck leve (Railway UI usa /docs por defeito).
app = FastAPI(title="SailScore API", docs_url="/swagger", redoc_url="/redoc")

# ---------- CORS ----------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://www.sailscore.online",
    "https://sailscore.online",
]
extra_origins = os.getenv("ALLOWED_ORIGINS")
if extra_origins:
    for o in [x.strip() for x in extra_origins.split(",") if x.strip()]:
        if o not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(o)
# Inclui LAN (192.168 / 10 / 172.16–31) para dev com Next no IP local; produção: ALLOWED_ORIGINS / regex no .env.
ALLOWED_ORIGIN_REGEX = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"^https?://("
    r"localhost|127\.0\.0\.1|"
    r"(?:[a-z0-9-]+\.)?sailscore\.online|"
    r"(?:[a-z0-9-]+\.)?vercel\.app|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r")(:\d+)?$",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
    max_age=86400,
)


# Garantir CORS mesmo em respostas de erro (ex.: 500) para evitar bloqueio no browser
import re as _re
_origins_set = set(ALLOWED_ORIGINS)

def _origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    if origin in _origins_set:
        return True
    return bool(_re.match(ALLOWED_ORIGIN_REGEX, origin))


@app.middleware("http")
async def add_cors_headers_to_all_responses(request, call_next):
    response = await call_next(request)
    origin = request.headers.get("origin")
    if origin and _origin_allowed(origin) and "access-control-allow-origin" not in {
        k.lower() for k in response.headers.keys()
    }:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# ---------- Exception handler ----------
logger = logging.getLogger("sailscore")

@app.exception_handler(Exception)
def unhandled_exception_handler(request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    response = JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
    )
    origin = request.headers.get("origin")
    if origin and _origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

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
    # Liga à BD após a app estar montada (evita bloquear import / healthcheck na Railway).
    try:
        create_database()
    except Exception:
        logging.getLogger("sailscore").exception(
            "create_database falhou no startup; continua a servir healthchecks"
        )
    (UPLOADS_DIR / "notices").mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / "news").mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / "regattas").mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / "sponsors").mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / "homepage").mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / "header").mkdir(parents=True, exist_ok=True)
    (MEDIA_DIR / "protests").mkdir(parents=True, exist_ok=True)
    (FILES_DIR / "protests").mkdir(parents=True, exist_ok=True)
    # Arrancar fila persistente de emails sem bloquear readiness da app.
    try:
        start_email_outbox_worker()
        process_email_outbox()
    except Exception:
        logger.exception(
            "Inicializacao da outbox de email falhou no startup; continua a servir healthchecks"
        )

# ---------- Routers ----------
app.include_router(auth.router)
app.include_router(metadata_routes.router)
app.include_router(organizations.router)
app.include_router(regattas.router)
# Clientes/proxies enviam POST /regattas?org=... (sem barra antes da query). O router só tinha POST /regattas/.
app.add_api_route(
    "/regattas",
    regattas.create_regatta,
    methods=["POST"],
    response_model=schemas.RegattaRead,
    tags=["regattas"],
    name="create_regatta_post_no_trailing_slash",
)
app.include_router(regatta_jury.router)
app.include_router(regatta_finances_router)
app.include_router(regatta_sponsors.router, tags=["regatta-sponsors"])
app.include_router(entries.router, prefix="/entries", tags=["entries"])
app.include_router(notices.router)
app.include_router(results.router, prefix="/results", tags=["Results"])
app.include_router(races.router, prefix="/races", tags=["Races"])
app.include_router(regatta_classes.router)
app.include_router(protests.router)
app.include_router(rule42.router)
app.include_router(hearings.router)
app.include_router(protest_time_limit.router)
app.include_router(scoring_routes.router)
app.include_router(requests_routes.router)
app.include_router(entry_attachments.router)
app.include_router(questions_router)
app.include_router(class_settings.router)
app.include_router(fleets_router.router)
app.include_router(public_fleets_router)
app.include_router(discards.router)
app.include_router(publication.router)
app.include_router(news.router)
app.include_router(design.router)
app.include_router(global_settings_routes.router)
app.include_router(marketing.router)

app.include_router(uploads.router)  # ✅ NOVO (POST /uploads/news)

# ---------- Utilitários ----------
@app.get("/docs")
def healthcheck_docs_path():
    """Resposta mínima para healthchecks configurados com path /docs (Railway)."""
    return {"status": "ok"}


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