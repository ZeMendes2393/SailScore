"""add hearings decision_snapshot_json (and panel_members)

Revision ID: 972181347b09
Revises: 1ff730bddbb6
Create Date: 2025-10-18 22:17:27.149379
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "972181347b09"
down_revision: Union[str, Sequence[str], None] = "1ff730bddbb6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Minimal migration: add only the columns needed by models.Hearing.
    Use Text for SQLite compatibility (we serialize JSON in the app layer).
    """
    with op.batch_alter_table("hearings", schema=None) as batch_op:
        # was missing → caused "no such column: hearings.decision_snapshot_json"
        batch_op.add_column(sa.Column("decision_snapshot_json", sa.Text(), nullable=True))
        # optional: if your model already has this field, add it now too
        batch_op.add_column(sa.Column("panel_members", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("hearings", schema=None) as batch_op:
        batch_op.drop_column("panel_members")
        batch_op.drop_column("decision_snapshot_json")
