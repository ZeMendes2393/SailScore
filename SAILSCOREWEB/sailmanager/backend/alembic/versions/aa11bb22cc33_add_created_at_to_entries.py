"""add created_at to entries

Revision ID: aa11bb22cc33
Revises: 9d0e1f2a3b4c
Create Date: 2026-03-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "aa11bb22cc33"
down_revision: Union[str, Sequence[str], None] = "9d0e1f2a3b4c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("entries")}

    if "created_at" not in cols:
        op.add_column(
            "entries",
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
        )

    # Backfill rows criadas antes desta migration
    bind.execute(
        sa.text("UPDATE entries SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("entries")}
    if "created_at" in cols:
        op.drop_column("entries", "created_at")

