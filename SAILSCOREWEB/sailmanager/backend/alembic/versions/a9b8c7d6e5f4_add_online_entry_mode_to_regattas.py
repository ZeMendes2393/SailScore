"""add online_entry_mode to regattas

Revision ID: a9b8c7d6e5f4
Revises: f0a1b2c3d4e5
Create Date: 2026-06-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, Sequence[str], None] = "f0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    if not _has_column("regattas", "online_entry_mode"):
        op.add_column(
            "regattas",
            sa.Column("online_entry_mode", sa.String(length=32), nullable=False, server_default=sa.text("'internal'")),
        )


def downgrade() -> None:
    if _has_column("regattas", "online_entry_mode"):
        op.drop_column("regattas", "online_entry_mode")
