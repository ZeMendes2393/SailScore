"""add paid field to entry

Revision ID: 68f7f6bc05c0
Revises: 19d807d4f31a
Create Date: 2025-07-08 00:47:48.044540

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '68f7f6bc05c0'
down_revision: Union[str, Sequence[str], None] = '19d807d4f31a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "entries" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("entries")}
    if "paid" not in cols:
        op.add_column("entries", sa.Column("paid", sa.Boolean(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "entries" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("entries")}
    if "paid" in cols:
        op.drop_column("entries", "paid")
