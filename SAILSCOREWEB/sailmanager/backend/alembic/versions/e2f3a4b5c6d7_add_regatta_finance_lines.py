"""add regatta_finance_lines

Revision ID: e2f3a4b5c6d7
Revises: c1d2e3f4a5b6
Create Date: 2026-05-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "regatta_finance_lines" not in insp.get_table_names():
        op.create_table(
            "regatta_finance_lines",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("regatta_id", sa.Integer(), nullable=False),
            sa.Column("kind", sa.String(length=16), nullable=False),
            sa.Column("description", sa.String(length=500), nullable=False),
            sa.Column("amount", sa.Float(), nullable=False),
            sa.Column("currency", sa.String(length=8), server_default="EUR", nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["regatta_id"], ["regattas.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_regatta_finance_lines_regatta_id"),
            "regatta_finance_lines",
            ["regatta_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "regatta_finance_lines" in insp.get_table_names():
        op.drop_index(op.f("ix_regatta_finance_lines_regatta_id"), table_name="regatta_finance_lines")
        op.drop_table("regatta_finance_lines")
