"""add online entry limit to regattas

Revision ID: dd2233445566
Revises: aa11bb22cc33
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "dd2233445566"
down_revision: Union[str, Sequence[str], None] = "aa11bb22cc33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("regattas", "online_entry_limit_enabled"):
        op.add_column(
            "regattas",
            sa.Column(
                "online_entry_limit_enabled",
                sa.Boolean(),
                nullable=False,
                server_default="0",
            ),
        )

    if not _has_column("regattas", "online_entry_limit"):
        op.add_column(
            "regattas",
            sa.Column(
                "online_entry_limit",
                sa.Integer(),
                nullable=True,
            ),
        )


def downgrade() -> None:
    if _has_column("regattas", "online_entry_limit"):
        op.drop_column("regattas", "online_entry_limit")
    if _has_column("regattas", "online_entry_limit_enabled"):
        op.drop_column("regattas", "online_entry_limit_enabled")

