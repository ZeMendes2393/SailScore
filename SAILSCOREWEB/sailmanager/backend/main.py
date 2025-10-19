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
    protest_time_limit,
    scoring as scoring_routes,
    entry_attachments
)
from app.routes import requests as requests_routes

# 👇 importa o módulo e o router diretamente
from app.routes import questions as questions_module
from app.routes.questions import router as questions_router

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
extra_origins = os.getenv("ALLOWED_ORIGINS")
if extra_origins:
    for o in [x.strip() for x in extra_origins.split(",") if x.strip()]:
        if o not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(o)
ALLOWED_ORIGIN_REGEX = os.getenv(
    "ALLOWED_ORIGIN_REGEX", r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
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

# 🔎 DEBUG correto + include do router das questions
print("Including questions router from:", getattr(questions_module, "__file__", "<unknown>"))
print("Questions router has paths:", [r.path for r in questions_router.routes])
app.include_router(questions_router)  # sem prefix extra

# ✅ inclui o router de questions
print("Including QUESTIONS router now…")

# 🔎 LOG: lista as rotas atuais da app (amostra e todas as que contêm 'questions')
_all = [r for r in app.routes if isinstance(r, APIRoute)]
print("App routes sample (first 20):", [r.path for r in _all[:20]])
print("App routes containing 'questions':", [r.path for r in _all if 'questions' in r.path])




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




@app.get("/_debug/has_questions")
def _has_questions():
    routes = [r.path for r in app.routes if isinstance(r, APIRoute)]
    return {
        "count": len(routes),
        "questions_routes": [p for p in routes if "questions" in p],
        "sample": routes[:30]
    }

# ---- DEBUG: pings diretos para isolar routing ----

@app.get("/__questions_ping_root")
def _ping_root():
    # se este responder 200, a app está viva e a rota registou.
    return {"ok": True, "where": "root"}

@app.get("/__questions_ping_scoped/{regatta_id}")
def _ping_scoped_direct(regatta_id: int):
    # rota *idêntica* à do router, mas registada diretamente na app
    return {"ok": True, "where": "main", "regatta_id": regatta_id}


# === DEBUG MUITO VERBOSO ===
from fastapi.routing import APIRoute

print("🟡 MAIN LOADED FROM:", __file__)

@app.on_event("startup")
def _debug_on_startup():
    routes = [r for r in app.routes if isinstance(r, APIRoute)]
    print("🟢 STARTUP:", __file__, "com", len(routes), "rotas")
    print("🟢 PRIMEIRAS 15 ROTAS:", [r.path for r in routes[:15]])

@app.get("/__whoami")
def __whoami():
    routes = [r.path for r in app.routes if isinstance(r, APIRoute)]
    return {
        "main_file": __file__,
        "routes_count": len(routes),
        "has_questions": [p for p in routes if "questions" in p],
        "sample": routes[:30],
    }

@app.get("/__questions_ping_root")
def __questions_ping_root():
    return {"ok": True, "where": "root"}

@app.get("/__questions_ping_scoped/{regatta_id}")
def __questions_ping_scoped(regatta_id: int):
    return {"ok": True, "where": "main", "regatta_id": regatta_id}
# === FIM DEBUG ===
# === DEBUG MUITO VERBOSO ===
from fastapi.routing import APIRoute

print("🟡 MAIN LOADED FROM:", __file__)

@app.on_event("startup")
def _debug_on_startup():
    routes = [r for r in app.routes if isinstance(r, APIRoute)]
    print("🟢 STARTUP:", __file__, "com", len(routes), "rotas")
    print("🟢 PRIMEIRAS 15 ROTAS:", [r.path for r in routes[:15]])

@app.get("/__whoami")
def __whoami():
    routes = [r.path for r in app.routes if isinstance(r, APIRoute)]
    return {
        "main_file": __file__,
        "routes_count": len(routes),
        "has_questions": [p for p in routes if "questions" in p],
        "sample": routes[:30],
    }

@app.get("/__questions_ping_root")
def __questions_ping_root():
    return {"ok": True, "where": "root"}

@app.get("/__questions_ping_scoped/{regatta_id}")
def __questions_ping_scoped(regatta_id: int):
    return {"ok": True, "where": "main", "regatta_id": regatta_id}
# === FIM DEBUG ===
