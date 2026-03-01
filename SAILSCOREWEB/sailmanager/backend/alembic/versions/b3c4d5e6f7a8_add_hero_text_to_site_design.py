"""add hero_title and hero_subtitle to site_design

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("site_design", schema=None) as batch_op:
        batch_op.add_column(sa.Column("hero_title", sa.String(500), nullable=True))
        batch_op.add_column(sa.Column("hero_subtitle", sa.String(500), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("site_design", schema=None) as batch_op:
        batch_op.drop_column("hero_subtitle")
        batch_op.drop_column("hero_title")
