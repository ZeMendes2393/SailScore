"""add regatta_sponsors table for sponsors and apoios

Revision ID: c4d5e6f7a8b2
Revises: a1b2c3d4e5f8
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b2"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "regatta_sponsors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("regatta_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(200), nullable=False),
        sa.Column("image_url", sa.String(500), nullable=False),
        sa.Column("link_url", sa.String(500), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["regatta_id"], ["regattas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_regatta_sponsors_regatta_id", "regatta_sponsors", ["regatta_id"])


def downgrade() -> None:
    op.drop_index("ix_regatta_sponsors_regatta_id", table_name="regatta_sponsors")
    op.drop_table("regatta_sponsors")
