"""add handicap time fields to results

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a8b9
Create Date: 2026-02-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "results",
        sa.Column("finish_time", sa.String(32), nullable=True),
    )
    op.add_column(
        "results",
        sa.Column("elapsed_time", sa.String(32), nullable=True),
    )
    op.add_column(
        "results",
        sa.Column("corrected_time", sa.String(32), nullable=True),
    )
    op.add_column(
        "results",
        sa.Column("delta", sa.String(32), nullable=True),
    )
    op.add_column(
        "results",
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("results", "notes")
    op.drop_column("results", "delta")
    op.drop_column("results", "corrected_time")
    op.drop_column("results", "elapsed_time")
    op.drop_column("results", "finish_time")
