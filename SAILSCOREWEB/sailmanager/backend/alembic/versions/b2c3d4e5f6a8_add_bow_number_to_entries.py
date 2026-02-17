"""add bow_number to entries

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2025-02-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("entries", "bow_number"):
        op.add_column(
            "entries",
            sa.Column("bow_number", sa.String(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("entries", "bow_number"):
        op.drop_column("entries", "bow_number")
