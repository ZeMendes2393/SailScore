"""add points_override to results

Revision ID: 2a688454f48c
Revises: e169bac139fe
Create Date: 2026-02-14 15:30:41.079421
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a688454f48c'
down_revision: Union[str, Sequence[str], None] = 'e169bac139fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "results",
        sa.Column("points_override", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("results", "points_override")
