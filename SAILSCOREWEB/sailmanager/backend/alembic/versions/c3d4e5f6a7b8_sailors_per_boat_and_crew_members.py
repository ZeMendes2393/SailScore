"""add sailors_per_boat to regatta_classes, crew_members to entries

Revision ID: c3d4e5f6a7b8
Revises: b1c8e9f2a3d4
Create Date: 2026-02-14

One Design: admin defines sailors per boat per class.
Entry: optional crew_members JSON for additional sailors.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b1c8e9f2a3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "regatta_classes",
        sa.Column("sailors_per_boat", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "entries",
        sa.Column("crew_members", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("entries", "crew_members")
    op.drop_column("regatta_classes", "sailors_per_boat")
