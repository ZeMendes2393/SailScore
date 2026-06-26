"""add results_pace_config to regattas

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-06-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, Sequence[str], None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("regattas", "results_pace_config"):
        op.add_column(
            "regattas",
            sa.Column("results_pace_config", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("regattas", "results_pace_config"):
        op.drop_column("regattas", "results_pace_config")
