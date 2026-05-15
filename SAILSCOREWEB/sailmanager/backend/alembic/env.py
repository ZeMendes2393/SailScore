# alembic/env.py
from logging.config import fileConfig
import sys
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool

# Tornar "app" e migration_utils importáveis
ALEMBIC_DIR = Path(__file__).resolve().parent
BASE_DIR = ALEMBIC_DIR.parent  # .../backend
for path in (BASE_DIR, ALEMBIC_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

# Importa Base e regista modelos (DATABASE_URL já normalizado como na app)
from app.database import (  # noqa: E402
    Base,
    DATABASE_URL,
    _sqlalchemy_connect_args,
)
import app.models  # noqa: F401,E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

db_url = DATABASE_URL
config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(
        db_url,
        connect_args=_sqlalchemy_connect_args(db_url),
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
