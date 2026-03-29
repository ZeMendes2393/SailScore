"""add initiator_party_text to protests (admin free-text initiator)

Revision ID: b0c1d2e3f4a5
Revises: a1b2c3d4e5f0
Create Date: 2026-03-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b0c1d2e3f4a5"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("protests")}
    if "initiator_party_text" not in cols:
        op.add_column(
            "protests",
            sa.Column("initiator_party_text", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("protests")}
    if "initiator_party_text" in cols:
        op.drop_column("protests", "initiator_party_text")
