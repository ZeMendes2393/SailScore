"""add rating and time_raw to results

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-02-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "results",
        sa.Column("rating", sa.Float(), nullable=True),
    )
    op.add_column(
        "results",
        sa.Column("time_raw", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("results", "time_raw")
    op.drop_column("results", "rating")

