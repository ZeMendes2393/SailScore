from logging.config import fileConfig
import os
import sys

from alembic import context
from sqlalchemy import engine_from_config, pool

# permitir importações a partir da raiz do projeto (../app/...)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# importa Base e engine da tua app
from app.database import Base, engine  # Base.metadata é o target_metadata
from app import models  # garante que os modelos estão importados

# Alembic Config (alembic.ini)
config = context.config

# Logging do Alembic
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadados dos modelos para autogenerate
target_metadata = Base.metadata

# Garante que o Alembic usa o MESMO URL que a tua app
# (evita desencontros entre alembic.ini e app.database)
if engine is not None and getattr(engine, "url", None):
    config.set_main_option("sqlalchemy.url", str(engine.url))


def run_migrations_offline() -> None:
    """Executa migrações em modo offline (sem Engine)."""
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,   # necessário em SQLite para ALTER TABLE
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Executa migrações em modo online (com Engine/Connection)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # necessário em SQLite para ALTER TABLE
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
