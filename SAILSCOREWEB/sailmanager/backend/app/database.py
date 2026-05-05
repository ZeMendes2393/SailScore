# app/database.py
from sqlalchemy import create_engine
from sqlalchemy import inspect
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Caminho absoluto para o test.db por defeito
DEFAULT_DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "test.db")
)


def _normalize_database_url(url: str) -> str:
    # SQLAlchemy 2 aceita postgres:// por retrocompat; normalizamos por consistência.
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


def _sqlalchemy_connect_args(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    if not (url.startswith("postgresql://") or url.startswith("postgres://")):
        return {}
    lower = url.lower()
    if "sslmode=" in lower or "ssl=" in lower:
        return {}
    explicit = os.getenv("PGSSLMODE", "").strip()
    if explicit:
        return {"sslmode": explicit}
    # Railway e vários hosts geridos exigem TLS; localhost fica sem forçar SSL.
    if any(
        h in lower
        for h in (
            "railway.internal",
            ".rlwy.net",
            "neon.tech",
            "amazonaws.com",
            "supabase.co",
        )
    ):
        return {"sslmode": "require"}
    return {}


DATABASE_URL = _normalize_database_url(
    os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")
)

engine = create_engine(
    DATABASE_URL,
    connect_args=_sqlalchemy_connect_args(DATABASE_URL),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def create_database():
    """
    Garante que o schema existe.

    - Em SQLite (muito comum em local/testes e quando `DATABASE_URL` não está configurado na
      plataforma), cria as tabelas a partir dos models para evitar erros do tipo
      "no such table: organizations" durante o startup e requests.
    - Em PostgreSQL, o schema é responsabilidade do Alembic (não criamos tabelas automaticamente).
    """
    if DATABASE_URL.startswith("sqlite:///"):
        db_file = DATABASE_URL.replace("sqlite:///", "", 1)
        os.makedirs(os.path.dirname(db_file), exist_ok=True)
        if not os.path.exists(db_file):
            open(db_file, "a").close()
        # Se o ficheiro existir mas estiver "vazio" (sem migrations), criamos o schema.
        try:
            insp = inspect(engine)
            if "organizations" not in insp.get_table_names():
                Base.metadata.create_all(bind=engine)
        except Exception:
            # Não bloqueia startup: erros aqui normalmente são por permissão/lock ou config incompleta.
            # A app pode continuar e falhar apenas em endpoints que dependem do schema.
            pass
    else:
        # abre/fecha só para validar conexão para bancos não-SQLite
        with engine.connect() as _:
            pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
