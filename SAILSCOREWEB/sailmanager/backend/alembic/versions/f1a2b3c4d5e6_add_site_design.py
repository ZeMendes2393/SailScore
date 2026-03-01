"""add site_design table for featured regatta IDs

Revision ID: f1a2b3c4d5e6
Revises: e6f7a8b9c4
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_design",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("featured_regatta_ids", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.PrimaryKeyConstraint("id"),
    )
    # Insert single row with empty list
    op.execute("INSERT INTO site_design (id, featured_regatta_ids) VALUES (1, '[]')")


def downgrade() -> None:
    op.drop_table("site_design")
