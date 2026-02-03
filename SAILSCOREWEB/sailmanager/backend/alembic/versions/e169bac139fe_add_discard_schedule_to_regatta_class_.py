"""add discard schedule to regatta_class_settings

Revision ID: e169bac139fe
Revises: 74889abe5114
Create Date: 2026-01-31 02:20:40.709500

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e169bac139fe"
down_revision: Union[str, Sequence[str], None] = "74889abe5114"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "regatta_class_settings",
        sa.Column("discard_schedule", sa.JSON(), nullable=True),
    )
    op.add_column(
        "regatta_class_settings",
        sa.Column(
            "discard_schedule_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "regatta_class_settings",
        sa.Column("discard_schedule_label", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("regatta_class_settings", "discard_schedule_label")
    op.drop_column("regatta_class_settings", "discard_schedule_active")
    op.drop_column("regatta_class_settings", "discard_schedule")
