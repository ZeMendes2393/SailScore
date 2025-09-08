# alembic/env.py
from logging.config import fileConfig
import os
import sys
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# ------------------------------------------------------------
# Deixar o pacote "app" importável (pasta backend no sys.path)
# ------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[1]  # .../backend
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Importa apenas o Base (NÃO importar o engine)
from app.database import Base  # Base.metadata será o target_metadata
import app.models  # noqa: F401  # garante que todas as tabelas estão registadas

# Alembic config (alembic.ini)
config = context.config

# Logging do Alembic
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadados dos modelos para autogenerate
target_metadata = Base.metadata

# ------------------------------------------------------------
# URL da BD: env var > alembic.ini
# (Não usar o engine da app aqui para não sobrepor a URL)
# ------------------------------------------------------------
db_url = (
    os.environ.get("SQLALCHEMY_DATABASE_URL")
    or os.environ.get("DATABASE_URL")
    or config.get_main_option("sqlalchemy.url")
)
config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    """Executa migrações em modo offline (sem Engine/Connection)."""
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # SQLite precisa disto para ALTER TABLE (batch ops)
        render_as_batch=True,
        # detetar alterações de tipos/servidor
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Executa migrações em modo online (com Engine/Connection)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section) or {},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,       # importante para SQLite
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
