"""Helpers partilhados para migrations Alembic idempotentes (BD já parcialmente migrada)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


def inspect_bind(bind=None):
    return sa.inspect(bind or op.get_bind())


def has_table(name: str, bind=None) -> bool:
    return inspect_bind(bind).has_table(name)


def has_index(table: str, name: str, bind=None) -> bool:
    insp = inspect_bind(bind)
    if not insp.has_table(table):
        return False
    try:
        return name in {i["name"] for i in insp.get_indexes(table)}
    except Exception:
        return False


def has_unique_constraint(table: str, name: str, bind=None) -> bool:
    insp = inspect_bind(bind)
    if not insp.has_table(table):
        return False
    try:
        return name in {
            uc.get("name")
            for uc in insp.get_unique_constraints(table)
            if uc.get("name")
        }
    except Exception:
        return False


def create_index_if_not_exists(name: str, table: str, columns, **kw) -> None:
    if not has_index(table, name):
        op.create_index(name, table, columns, **kw)


def create_unique_constraint_if_not_exists(name: str, table: str, columns, **kw) -> None:
    if not has_unique_constraint(table, name):
        op.create_unique_constraint(name, table, columns, **kw)
