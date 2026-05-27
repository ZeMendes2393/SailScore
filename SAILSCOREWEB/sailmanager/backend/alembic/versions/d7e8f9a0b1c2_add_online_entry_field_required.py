"""add online_entry_field_required to regattas

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-05-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, Sequence[str], None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    if not _has_column("regattas", "online_entry_field_required"):
        op.add_column(
            "regattas",
            sa.Column("online_entry_field_required", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("regattas", "online_entry_field_required"):
        op.drop_column("regattas", "online_entry_field_required")
