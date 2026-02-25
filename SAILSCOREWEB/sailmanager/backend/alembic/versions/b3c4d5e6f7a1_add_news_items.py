"""add news_items table for homepage news

Revision ID: b3c4d5e6f7a1
Revises: a2b3c4d5e6f0
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3c4d5e6f7a1"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "news_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("excerpt", sa.String(1000), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("category", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_news_items_id", "news_items", ["id"])
    op.create_index("ix_news_items_published_at", "news_items", ["published_at"])


def downgrade() -> None:
    op.drop_index("ix_news_items_published_at", table_name="news_items")
    op.drop_index("ix_news_items_id", table_name="news_items")
    op.drop_table("news_items")
