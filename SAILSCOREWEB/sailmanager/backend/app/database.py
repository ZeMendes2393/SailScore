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
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
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
