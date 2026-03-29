"""add online entry limits by class

Revision ID: ff6677889900
Revises: ee44ff55aa66
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ff6677889900"
down_revision: Union[str, Sequence[str], None] = "ee44ff55aa66"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("regattas", "online_entry_limits_by_class"):
        op.add_column(
            "regattas",
            sa.Column("online_entry_limits_by_class", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("regattas", "online_entry_limits_by_class"):
        op.drop_column("regattas", "online_entry_limits_by_class")

