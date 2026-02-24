"""add orc_rating_mode to races (low | medium | high)

Revision ID: e8f9a0b1c2d3
Revises: d5e6f7a8b9c0
Create Date: 2026-02-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "races",
        sa.Column("orc_rating_mode", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("races", "orc_rating_mode")
