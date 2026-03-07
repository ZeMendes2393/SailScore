"""add listing_logo_url to regattas

Revision ID: b4c5d6e7f8a0
Revises: a2b3c4d5e6f9
Create Date: 2025-02-24

"""
from alembic import op
import sqlalchemy as sa


revision = "b4c5d6e7f8a0"
down_revision = "a2b3c4d5e6f9"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("regattas", schema=None) as batch_op:
        batch_op.add_column(sa.Column("listing_logo_url", sa.String(500), nullable=True))


def downgrade():
    with op.batch_alter_table("regattas", schema=None) as batch_op:
        batch_op.drop_column("listing_logo_url")
