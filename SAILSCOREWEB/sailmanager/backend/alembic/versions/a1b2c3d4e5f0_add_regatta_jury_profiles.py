"""add regatta_jury_profiles for jury credentials

Revision ID: a1b2c3d4e5f0
Revises: ff6677889900
Create Date: 2026-03-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f0"
down_revision: Union[str, Sequence[str], None] = "ff6677889900"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables():
    bind = op.get_bind()
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    if "regatta_jury_profiles" in _tables():
        return
    op.create_table(
        "regatta_jury_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("regatta_id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["regatta_id"], ["regattas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_regatta_jury_profiles_regatta_id", "regatta_jury_profiles", ["regatta_id"], unique=False)


def downgrade() -> None:
    if "regatta_jury_profiles" in _tables():
        op.drop_index("ix_regatta_jury_profiles_regatta_id", table_name="regatta_jury_profiles")
        op.drop_table("regatta_jury_profiles")
