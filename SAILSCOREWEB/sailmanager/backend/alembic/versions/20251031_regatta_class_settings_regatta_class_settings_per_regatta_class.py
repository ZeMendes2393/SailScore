"""regatta_class_settings per regatta/class

Revision ID: 20251031_regatta_class_settings
Revises: 0f9ba055fbab
Create Date: 2025-10-31 14:11:22.055259
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20251031_regatta_class_settings"
down_revision: Union[str, Sequence[str], None] = "0f9ba055fbab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "regatta_class_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "regatta_id",
            sa.Integer,
            sa.ForeignKey("regattas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("class_name", sa.String(length=255), nullable=False),
        sa.Column("discard_count", sa.Integer, nullable=True),
        sa.Column("discard_threshold", sa.Integer, nullable=True),
        sa.Column("scoring_codes", sa.JSON, nullable=True),  # e.g. {"DNF": 999}
        sa.UniqueConstraint(
            "regatta_id",
            "class_name",
            name="uq_regatta_class_settings_regatta_class",
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("regatta_class_settings")
