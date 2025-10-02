"""hearings add decision_at & panel_chair

Revision ID: b9a6f12f4c3a
Revises: 88b7377ef47e
Create Date: 2025-10-01 12:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b9a6f12f4c3a"
down_revision: Union[str, Sequence[str], None] = "88b7377ef47e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # usar batch em SQLite para ALTER TABLE seguro
    with op.batch_alter_table("hearings") as batch:
        batch.add_column(sa.Column("decision_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("panel_chair", sa.String(length=200), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("hearings") as batch:
        batch.drop_column("panel_chair")
        batch.drop_column("decision_at")
