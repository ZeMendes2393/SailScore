"""add data promotion opt-out consent fields

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-08-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, Sequence[str], None] = "a6b7c8d9e0f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("regattas", "online_entry_data_opt_out_enabled"):
        op.add_column(
            "regattas",
            sa.Column(
                "online_entry_data_opt_out_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
    if not _has_column("regattas", "online_entry_data_opt_out_text"):
        op.add_column(
            "regattas",
            sa.Column("online_entry_data_opt_out_text", sa.Text(), nullable=True),
        )
    if not _has_column("entries", "accepted_terms"):
        op.add_column(
            "entries",
            sa.Column(
                "accepted_terms",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
    if not _has_column("entries", "data_promotion_opt_out"):
        op.add_column(
            "entries",
            sa.Column(
                "data_promotion_opt_out",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )


def downgrade() -> None:
    if _has_column("entries", "data_promotion_opt_out"):
        op.drop_column("entries", "data_promotion_opt_out")
    if _has_column("entries", "accepted_terms"):
        op.drop_column("entries", "accepted_terms")
    if _has_column("regattas", "online_entry_data_opt_out_text"):
        op.drop_column("regattas", "online_entry_data_opt_out_text")
    if _has_column("regattas", "online_entry_data_opt_out_enabled"):
        op.drop_column("regattas", "online_entry_data_opt_out_enabled")
