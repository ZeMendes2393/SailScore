"""add footer fields to site_design

Revision ID: 20260309_add_footer_to_site_design
Revises: a2b3c4d5e6f9
Create Date: 2026-03-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260309_add_footer_to_site_design"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("site_design", schema=None) as batch_op:
        batch_op.add_column(sa.Column("footer_site_name", sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column("footer_tagline", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("footer_contact_email", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("footer_phone", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("footer_address", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("footer_instagram_url", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("footer_facebook_url", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("footer_show_privacy_policy", sa.Boolean(), nullable=False, server_default=sa.text("1")))
        batch_op.add_column(sa.Column("footer_show_terms_of_service", sa.Boolean(), nullable=False, server_default=sa.text("1")))
        batch_op.add_column(sa.Column("footer_show_cookie_policy", sa.Boolean(), nullable=False, server_default=sa.text("1")))
        batch_op.add_column(sa.Column("footer_privacy_policy_text", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("footer_terms_of_service_text", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("footer_cookie_policy_text", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("site_design", schema=None) as batch_op:
        batch_op.drop_column("footer_cookie_policy_text")
        batch_op.drop_column("footer_terms_of_service_text")
        batch_op.drop_column("footer_privacy_policy_text")
        batch_op.drop_column("footer_show_cookie_policy")
        batch_op.drop_column("footer_show_terms_of_service")
        batch_op.drop_column("footer_show_privacy_policy")
        batch_op.drop_column("footer_facebook_url")
        batch_op.drop_column("footer_instagram_url")
        batch_op.drop_column("footer_address")
        batch_op.drop_column("footer_phone")
        batch_op.drop_column("footer_contact_email")
        batch_op.drop_column("footer_tagline")
        batch_op.drop_column("footer_site_name")

