"""add results_overall_columns to regattas

Revision ID: c3d4e5f6a8b9
Revises: b2c3d4e5f6a8
Create Date: 2025-02-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c3d4e5f6a8b9"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("regattas", "results_overall_columns"):
        op.add_column(
            "regattas",
            sa.Column("results_overall_columns", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("regattas", "results_overall_columns"):
        op.drop_column("regattas", "results_overall_columns")
