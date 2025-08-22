# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute

from app.database import create_database
from app.routes import regattas, entries, auth, notices, results, races, regatta_classes

app = FastAPI(title="SailScore API")

# ✅ CORS (localhost + 127.0.0.1 em qualquer porta)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(regatta_classes.router, prefix="/regatta-classes",  tags=["RegattaClasses"])  # 👈 prefix adicionado

# ---------- DEBUG (opcional) ----------
@app.get("/_debug/routes")
def _debug_routes():
    return [
        {"path": r.path, "methods": list(r.methods), "name": r.name}
        for r in app.routes if isinstance(r, APIRoute)
    ]

def custom_openapi():
    schema = get_openapi(
        title=app.title,
        version="1.0.0",
        description="SailScore API",
        routes=app.routes,
    )
    for p in schema.get("paths", {}):
        if "position" in p:
            print(">>> OPENAPI PATH:", p)
    return schema

app.openapi = custom_openapi
app.openapi_schema = None

# log rápido para ver de onde vem /results/{id}/position
for r in app.routes:
    if isinstance(r, APIRoute) and "position" in r.path:
        fn = r.endpoint
        print(">>> ROUTE:", r.path, r.methods,
              "| FILE:", fn.__code__.co_filename,
              "| LINE:", fn.__code__.co_firstlineno,
              "| NAME:", r.name)
# ---------- /DEBUG ----------

# ✅ Ficheiros estáticos (ex.: /uploads/ficheiro.pdf)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
