"""add class_type to regatta_classes, rating and boat_model to entries

Revision ID: b1c8e9f2a3d4
Revises: 2a688454f48c
Create Date: 2026-02-14

One Design vs Handicap: RegattaClass gains class_type (one_design|handicap).
Entries gain rating and boat_model for handicap classes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1c8e9f2a3d4"
down_revision: Union[str, Sequence[str], None] = "2a688454f48c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "regatta_classes",
        sa.Column("class_type", sa.String(20), nullable=False, server_default="one_design"),
    )
    op.add_column(
        "entries",
        sa.Column("boat_model", sa.String(), nullable=True),
    )
    op.add_column(
        "entries",
        sa.Column("rating", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("entries", "rating")
    op.drop_column("entries", "boat_model")
    op.drop_column("regatta_classes", "class_type")
