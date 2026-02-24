"""add regatta_class_publication table

Revision ID: a1b2c3d4e5f8
Revises: e8f9a0b1c2d3
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f8"
down_revision: Union[str, Sequence[str], None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "regatta_class_publication",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("regatta_id", sa.Integer(), nullable=False),
        sa.Column("class_name", sa.String(255), nullable=False),
        sa.Column("published_races_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["regatta_id"], ["regattas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("regatta_id", "class_name", name="uq_regatta_class_publication"),
    )
    op.create_index("ix_regatta_class_publication_regatta_id", "regatta_class_publication", ["regatta_id"])
    op.create_index("ix_regatta_class_publication_class_name", "regatta_class_publication", ["class_name"])


def downgrade() -> None:
    op.drop_index("ix_regatta_class_publication_class_name", "regatta_class_publication")
    op.drop_index("ix_regatta_class_publication_regatta_id", "regatta_class_publication")
    op.drop_table("regatta_class_publication")
