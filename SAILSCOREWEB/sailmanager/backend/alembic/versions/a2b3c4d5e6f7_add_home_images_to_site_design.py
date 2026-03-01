"""add home_images to site_design

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("site_design", schema=None) as batch_op:
        batch_op.add_column(sa.Column("home_images", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("site_design", schema=None) as batch_op:
        batch_op.drop_column("home_images")
