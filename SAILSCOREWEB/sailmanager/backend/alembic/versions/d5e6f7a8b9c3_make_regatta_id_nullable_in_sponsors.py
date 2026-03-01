"""make regatta_id nullable in regatta_sponsors (global/all events)

Revision ID: d5e6f7a8b9c3
Revises: c4d5e6f7a8b2
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c3"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("regatta_sponsors", schema=None) as batch_op:
        batch_op.alter_column(
            "regatta_id",
            existing_type=sa.Integer(),
            nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("regatta_sponsors", schema=None) as batch_op:
        batch_op.alter_column(
            "regatta_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
