# app/database.py
from sqlalchemy import create_engine
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
    NÃO cria tabelas! (nada de Base.metadata.create_all)
    Apenas garante que o ficheiro existe para SQLite.
    O schema é responsabilidade do Alembic.
    """
    if DATABASE_URL.startswith("sqlite:///"):
        db_file = DATABASE_URL.replace("sqlite:///", "", 1)
        os.makedirs(os.path.dirname(db_file), exist_ok=True)
        if not os.path.exists(db_file):
            open(db_file, "a").close()
    # abre/fecha só para garantir o ficheiro
    with engine.connect() as _:
        pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
