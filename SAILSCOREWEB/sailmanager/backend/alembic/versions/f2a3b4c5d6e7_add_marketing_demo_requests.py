"""add marketing_demo_requests table

Revision ID: f2a3b4c5d6e7
Revises: e2f3a4b5c6d7
Create Date: 2026-05-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "marketing_demo_requests" not in insp.get_table_names():
        op.create_table(
            "marketing_demo_requests",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column("full_name", sa.String(length=120), nullable=False),
            sa.Column("email", sa.String(length=254), nullable=False),
            sa.Column("club_name", sa.String(length=200), nullable=False),
            sa.Column("phone", sa.String(length=40), nullable=True),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column(
                "notification_email_sent",
                sa.Boolean(),
                server_default=sa.text("false"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_marketing_demo_requests_created_at"),
            "marketing_demo_requests",
            ["created_at"],
            unique=False,
        )
        op.create_index(
            op.f("ix_marketing_demo_requests_email"),
            "marketing_demo_requests",
            ["email"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "marketing_demo_requests" in insp.get_table_names():
        op.drop_index(op.f("ix_marketing_demo_requests_email"), table_name="marketing_demo_requests")
        op.drop_index(op.f("ix_marketing_demo_requests_created_at"), table_name="marketing_demo_requests")
        op.drop_table("marketing_demo_requests")
