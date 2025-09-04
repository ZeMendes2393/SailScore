# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute

from app.database import create_database
from app.routes import regattas, entries, auth, notices, results, races, regatta_classes, protests

app = FastAPI(title="SailScore API")

# ✅ CORS — origens explícitas (melhor para dev)
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,   # <- em vez de allow_origin_regex
    allow_credentials=True,
    allow_methods=["*"],             # permite todos os métodos (inclui OPTIONS do preflight)
    allow_headers=["*"],             # permite todos os headers (inclui Authorization, Content-Type, etc.)
)

# ✅ Criar base de dados (se ainda não existir)
create_database()

# ✅ Routers
app.include_router(auth.router,            prefix="/auth",             tags=["Auth"])
app.include_router(regattas.router,        prefix="/regattas",         tags=["Regattas"])
app.include_router(entries.router,         prefix="/entries",          tags=["Entries"])
app.include_router(notices.router,         prefix="/notices",          tags=["Notices"])
app.include_router(results.router,         prefix="/results",          tags=["Results"])
app.include_router(races.router,           prefix="/races",            tags=["Races"])
app.include_router(regatta_classes.router, prefix="/regatta-classes",  tags=["RegattaClasses"])

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

# ✅ Ficheiros estáticos (ex.: /uploads/ficheiro.pdf)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(protests.router)  # sem prefix extra; o router já tem /regattas/{id}/protests

