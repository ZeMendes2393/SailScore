"""add publish fields to fleet_sets

Revision ID: fa749dd8daec
Revises: b78df6eeb67d
Create Date: 2025-12-08 12:39:16.360249
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa749dd8daec'
down_revision: Union[str, Sequence[str], None] = 'b78df6eeb67d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "fleet_sets",
        sa.Column(
            "is_published",
            sa.Boolean(),
            nullable=False,
            server_default="false"   # garante retrocompatibilidade
        )
    )

    op.add_column(
        "fleet_sets",
        sa.Column(
            "public_title",
            sa.String(length=255),
            nullable=True
        )
    )

    op.add_column(
        "fleet_sets",
        sa.Column(
            "published_at",
            sa.DateTime(),
            nullable=True
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("fleet_sets", "published_at")
    op.drop_column("fleet_sets", "public_title")
    op.drop_column("fleet_sets", "is_published")
