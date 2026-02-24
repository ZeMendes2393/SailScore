"""add handicap_method to races (manual | anc | orc)

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-02-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, Sequence[str], None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "races",
        sa.Column("handicap_method", sa.String(length=16), nullable=True, server_default="manual"),
    )


def downgrade() -> None:
    op.drop_column("races", "handicap_method")
