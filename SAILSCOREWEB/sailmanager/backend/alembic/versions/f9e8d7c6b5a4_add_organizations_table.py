"""add organizations table for multi-organization foundation

Revision ID: f9e8d7c6b5a4
Revises: e7f8a9b0c1d2
Create Date: 2026-03-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9e8d7c6b5a4"
down_revision: Union[str, Sequence[str], None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_organizations_name", "organizations", ["name"], unique=False)
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_index("ix_organizations_name", table_name="organizations")
    op.drop_table("organizations")
