"""add rating_type, orc_low, orc_medium, orc_high to entries

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4
Create Date: 2026-02-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c0d1e2f3a4b5"
down_revision: Union[str, Sequence[str], None] = "b9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "entries",
        sa.Column("rating_type", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "entries",
        sa.Column("orc_low", sa.Float(), nullable=True),
    )
    op.add_column(
        "entries",
        sa.Column("orc_medium", sa.Float(), nullable=True),
    )
    op.add_column(
        "entries",
        sa.Column("orc_high", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("entries", "orc_high")
    op.drop_column("entries", "orc_medium")
    op.drop_column("entries", "orc_low")
    op.drop_column("entries", "rating_type")
