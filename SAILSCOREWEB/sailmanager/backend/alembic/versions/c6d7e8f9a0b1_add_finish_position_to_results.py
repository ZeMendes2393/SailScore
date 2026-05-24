"""add finish_position to results

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-05-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c6d7e8f9a0b1"
down_revision: Union[str, Sequence[str], None] = "b5c6d7e8f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UNRANKED_POSITION = 10**9


def upgrade() -> None:
    op.add_column("results", sa.Column("finish_position", sa.Integer(), nullable=True))
    # Resultados scored sem penalty: finish_position = ordem de chegada actual
    op.execute(
        sa.text(
            """
            UPDATE results
            SET finish_position = position
            WHERE finish_position IS NULL
              AND position < :unranked
              AND (code IS NULL OR TRIM(code) = '')
            """
        ).bindparams(unranked=UNRANKED_POSITION)
    )


def downgrade() -> None:
    op.drop_column("results", "finish_position")
