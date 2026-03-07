"""add club_logo_url and club_logo_link to site_design

Revision ID: a2b3c4d5e6f9
Revises: b3c4d5e6f7a8
Create Date: 2025-02-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a2b3c4d5e6f9"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("site_design", schema=None) as batch_op:
        batch_op.add_column(sa.Column("club_logo_url", sa.String(500), nullable=True))
        batch_op.add_column(sa.Column("club_logo_link", sa.String(500), nullable=True))


def downgrade():
    with op.batch_alter_table("site_design", schema=None) as batch_op:
        batch_op.drop_column("club_logo_link")
        batch_op.drop_column("club_logo_url")
