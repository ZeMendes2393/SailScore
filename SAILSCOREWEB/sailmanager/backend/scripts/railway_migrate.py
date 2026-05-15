#!/usr/bin/env python3
"""
Pre-deploy Railway: alinha alembic_version com o schema existente e corre upgrade head.

Útil quando a BD de produção foi criada/atualizada fora do Alembic: o schema já tem
tabelas mas alembic_version está atrás, o que causava DuplicateTable em create_table.
"""
from __future__ import annotations

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import DATABASE_URL, _sqlalchemy_connect_args  # noqa: E402

# Da revisão mais recente para a mais antiga (primeiro match = nível máximo detectado).
SCHEMA_MARKERS: list[tuple[str, list[str]]] = [
    ("f2a3b4c5d6e7", ["marketing_demo_requests"]),
    ("e2f3a4b5c6d7", ["regatta_finance_lines"]),
    ("a1b2c3d4e5f0", ["regatta_jury_profiles"]),
    ("f9e8d7c6b5a4", ["organizations"]),
    ("e7f8a9b0c1d2", ["global_settings"]),
    ("f1a2b3c4d5e6", ["site_design"]),
    ("a1b2c3d4e5f8", ["regatta_class_publication"]),
    ("c4d5e6f7a8b2", ["regatta_sponsors"]),
    ("b3c4d5e6f7a1", ["news_items"]),
    ("1ff730bddbb6", ["questions"]),
    ("f09961f2e4ff", ["regatta_counters", "requests"]),
    ("077b4bd3012b", ["scoring_enquiries"]),
    ("cc7d549f37c4", ["rule42_records", "hearings"]),
    ("ef919d399974", ["protests", "protest_parties"]),
]


def _detect_schema_revision(table_names: set[str]) -> str | None:
    for revision, required in SCHEMA_MARKERS:
        if all(t in table_names for t in required):
            return revision
    return None


def _read_alembic_version(engine) -> str | None:
    with engine.connect() as conn:
        try:
            return conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar()
        except Exception:
            return None


def _is_revision_ahead_of(script: ScriptDirectory, candidate: str, current: str) -> bool:
    if candidate == current:
        return False
    for rev in script.iterate_revisions(candidate, "base"):
        if rev.revision == current:
            return True
    return False


def main() -> int:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))

    engine = create_engine(
        DATABASE_URL,
        connect_args=_sqlalchemy_connect_args(DATABASE_URL),
    )
    insp = inspect(engine)
    tables = set(insp.get_table_names())

    script = ScriptDirectory.from_config(cfg)
    current = _read_alembic_version(engine)
    detected = _detect_schema_revision(tables)

    if detected and (current is None or _is_revision_ahead_of(script, detected, current)):
        print(
            f"[railway_migrate] alembic_version={current!r}, schema ~{detected!r} -> stamp",
            flush=True,
        )
        command.stamp(cfg, detected)
    elif detected:
        print(
            f"[railway_migrate] alembic_version={current!r}, schema markers ok (detected {detected!r})",
            flush=True,
        )
    else:
        print(f"[railway_migrate] alembic_version={current!r}, no schema markers matched", flush=True)

    print("[railway_migrate] alembic upgrade head", flush=True)
    command.upgrade(cfg, "head")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
