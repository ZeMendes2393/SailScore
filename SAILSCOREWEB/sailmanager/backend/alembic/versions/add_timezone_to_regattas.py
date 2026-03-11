"""add timezone to regattas

Revision ID: add_timezone_regattas
Revises: add_pub_at_regatta_class_pub
Create Date: 2026-03-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_timezone_regattas"
down_revision: Union[str, Sequence[str], None] = "add_pub_at_regatta_class_pub"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("regattas", schema=None) as batch_op:
        batch_op.add_column(sa.Column("timezone", sa.String(length=64), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("regattas", schema=None) as batch_op:
        batch_op.drop_column("timezone")
