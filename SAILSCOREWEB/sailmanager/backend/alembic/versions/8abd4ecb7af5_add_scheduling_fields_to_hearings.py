"""add scheduling fields to hearings

Revision ID: 8abd4ecb7af5
Revises: cc7d549f37c4
Create Date: 2025-09-15 20:35:05.956087
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8abd4ecb7af5"
down_revision: Union[str, Sequence[str], None] = "cc7d549f37c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("hearings")}

    with op.batch_alter_table("hearings") as batch:
        if "sch_time" not in cols:
            batch.add_column(sa.Column("sch_time", sa.String(length=5), nullable=True))
        if "room" not in cols:
            batch.add_column(sa.Column("room", sa.String(length=128), nullable=True))
        if "status" not in cols:
            batch.add_column(sa.Column("status", sa.String(length=16), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("hearings")}

    with op.batch_alter_table("hearings") as batch:
        if "status" in cols:
            batch.drop_column("status")
        if "room" in cols:
            batch.drop_column("room")
        if "sch_time" in cols:
            batch.drop_column("sch_time")
