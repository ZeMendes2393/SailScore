"""add waiting list flag to entries

Revision ID: ee44ff55aa66
Revises: dd2233445566
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ee44ff55aa66"
down_revision: Union[str, Sequence[str], None] = "dd2233445566"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("entries", "waiting_list"):
        op.add_column(
            "entries",
            sa.Column(
                "waiting_list",
                sa.Boolean(),
                nullable=False,
                server_default="0",
            ),
        )


def downgrade() -> None:
    if _has_column("entries", "waiting_list"):
        op.drop_column("entries", "waiting_list")

