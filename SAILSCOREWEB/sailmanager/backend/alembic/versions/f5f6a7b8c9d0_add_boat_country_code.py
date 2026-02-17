"""add boat_country_code to entries and results

Revision ID: f5f6a7b8c9d0
Revises: e5f6a7b8c9d0
Create Date: 2026-02-14

Country code (ISO alpha-3) associated with sail number for display format [Flag] [Code] [Number].
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("entries", sa.Column("boat_country_code", sa.String(3), nullable=True))
    op.add_column("results", sa.Column("boat_country_code", sa.String(3), nullable=True))


def downgrade() -> None:
    op.drop_column("results", "boat_country_code")
    op.drop_column("entries", "boat_country_code")
