"""add published_at to regatta_class_publication

Revision ID: add_pub_at_regatta_class_pub
Revises: 20260309_add_footer_to_site_design
Create Date: 2026-03-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_pub_at_regatta_class_pub"
down_revision: Union[str, Sequence[str], None] = "20260309_add_footer_to_site_design"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("regatta_class_publication", schema=None) as batch_op:
        batch_op.add_column(sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("regatta_class_publication", schema=None) as batch_op:
        batch_op.drop_column("published_at")
