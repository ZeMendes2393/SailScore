"""add entry_list_columns to regattas

Revision ID: a1b2c3d4e5f7
Revises: 2a688454f48c
Create Date: 2025-02-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("regattas", "entry_list_columns"):
        op.add_column(
            "regattas",
            sa.Column("entry_list_columns", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("regattas", "entry_list_columns"):
        op.drop_column("regattas", "entry_list_columns")
