"""add global_settings table for org/payment variables

Revision ID: e7f8a9b0c1d2
Revises: merge_heads_20260309
Create Date: 2026-02-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "merge_heads_20260309"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "global_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(128), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_global_settings_key", "global_settings", ["key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_global_settings_key", table_name="global_settings")
    op.drop_table("global_settings")
