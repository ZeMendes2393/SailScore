"""add home_images to regattas (up to 3 images with focal point)

Revision ID: e6f7a8b9c4
Revises: d5e6f7a8b9c3
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c4"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("regattas", schema=None) as batch_op:
        batch_op.add_column(sa.Column("home_images", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("regattas", schema=None) as batch_op:
        batch_op.drop_column("home_images")
