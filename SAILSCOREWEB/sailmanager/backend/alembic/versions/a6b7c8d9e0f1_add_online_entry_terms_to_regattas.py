"""add online entry terms to regattas

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-07-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a6b7c8d9e0f1"
down_revision: Union[str, Sequence[str], None] = "f5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("regattas", "online_entry_terms_enabled"):
        op.add_column(
            "regattas",
            sa.Column("online_entry_terms_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
    if not _has_column("regattas", "online_entry_terms_title"):
        op.add_column("regattas", sa.Column("online_entry_terms_title", sa.String(length=200), nullable=True))
    if not _has_column("regattas", "online_entry_terms_text"):
        op.add_column("regattas", sa.Column("online_entry_terms_text", sa.Text(), nullable=True))


def downgrade() -> None:
    if _has_column("regattas", "online_entry_terms_text"):
        op.drop_column("regattas", "online_entry_terms_text")
    if _has_column("regattas", "online_entry_terms_title"):
        op.drop_column("regattas", "online_entry_terms_title")
    if _has_column("regattas", "online_entry_terms_enabled"):
        op.drop_column("regattas", "online_entry_terms_enabled")
