"""add owner_first_name, owner_last_name, owner_email to entries (handicap)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-14

For handicap classes, entries can store boat owner (in addition to helm/skipper).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("entries", sa.Column("owner_first_name", sa.String(), nullable=True))
    op.add_column("entries", sa.Column("owner_last_name", sa.String(), nullable=True))
    op.add_column("entries", sa.Column("owner_email", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("entries", "owner_email")
    op.drop_column("entries", "owner_last_name")
    op.drop_column("entries", "owner_first_name")
