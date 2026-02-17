"""add federation_license to entries

Revision ID: a1b2c3d4e5f6
Revises: f5f6a7b8c9d0
Create Date: 2026-02-14

Federation license (required for all sailors: helm and crew).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("entries", sa.Column("federation_license", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("entries", "federation_license")
