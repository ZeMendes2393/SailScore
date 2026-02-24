"""add start_time/start_day to races and finish_day to results

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-02-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "races",
        sa.Column("start_time", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "races",
        sa.Column("start_day", sa.Integer(), nullable=True, server_default="1"),
    )
    op.add_column(
        "results",
        sa.Column("finish_day", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("results", "finish_day")
    op.drop_column("races", "start_day")
    op.drop_column("races", "start_time")
