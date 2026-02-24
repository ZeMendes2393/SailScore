"""drop time_raw from results (handicap usa apenas elapsed_time)

Revision ID: a8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-02-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, Sequence[str], None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("results", "time_raw")


def downgrade() -> None:
    op.add_column(
        "results",
        sa.Column("time_raw", sa.String(length=32), nullable=True),
    )
