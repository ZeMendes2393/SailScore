from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import regattas, entries, auth, notices
from app.database import create_database
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="SailScore API")  # ✅ Cria o app primeiro!

# ✅ Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.include_router(notices.router, prefix="/notices", tags=["Notices"])  # <- Agora está no sítio certo!



app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
