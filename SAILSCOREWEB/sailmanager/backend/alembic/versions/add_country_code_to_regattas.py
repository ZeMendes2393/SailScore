"""add country_code to regattas

Revision ID: add_country_code_regattas
Revises: add_timezone_regattas
Create Date: 2026-03-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_country_code_regattas"
down_revision: Union[str, Sequence[str], None] = "add_timezone_regattas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("regattas", schema=None) as batch_op:
        batch_op.add_column(sa.Column("country_code", sa.String(length=2), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("regattas", schema=None) as batch_op:
        batch_op.drop_column("country_code")
