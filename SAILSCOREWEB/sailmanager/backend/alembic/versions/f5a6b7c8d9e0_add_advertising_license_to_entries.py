"""add advertising_license to entries

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-07-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, Sequence[str], None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("entries", "advertising_license"):
        op.add_column(
            "entries",
            sa.Column("advertising_license", sa.String(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("entries", "advertising_license"):
        op.drop_column("entries", "advertising_license")
