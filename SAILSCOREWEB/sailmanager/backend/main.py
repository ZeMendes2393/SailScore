from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import create_database
from app.routes import regattas, entries, auth, notices, results, races

app = FastAPI(title="SailScore API")

# ✅ Middleware CORS - corrigido para funcionar com cookies/headers e frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # ⚠️ importante não usar "*" com allow_credentials=True
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Criar base de dados
create_database()

# ✅ Incluir rotas
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(regattas.router, prefix="/regattas", tags=["Regattas"])
app.include_router(entries.router, prefix="/entries", tags=["Entries"])
app.include_router(notices.router, prefix="/notices", tags=["Notices"])

# ✅ Ficheiros estáticos (uploads)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")




app.include_router(results.router, prefix="/results", tags=["Results"])  # ✅ adicionar
app.include_router(races.router, prefix="/races", tags=["Races"])
