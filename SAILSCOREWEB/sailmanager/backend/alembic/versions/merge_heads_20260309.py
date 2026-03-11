"""merge multiple heads (country_code, news, listing_logo, rating_orc)

Revision ID: merge_heads_20260309
Revises: add_country_code_regattas, b3c4d5e6f7a1, b4c5d6e7f8a0, c0d1e2f3a4b5
Create Date: 2026-03-09

"""
from typing import Sequence, Union

from alembic import op


revision: str = "merge_heads_20260309"
down_revision: Union[str, Sequence[str], None] = (
    "add_country_code_regattas",
    "b3c4d5e6f7a1",
    "b4c5d6e7f8a0",
    "c0d1e2f3a4b5",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
