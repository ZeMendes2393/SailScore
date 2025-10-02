"""hearings add decision_pdf_url

Revision ID: 88b7377ef47e
Revises: c42d8c56a27a
Create Date: 2025-09-30 21:13:08.324623
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "88b7377ef47e"
down_revision: Union[str, Sequence[str], None] = "c42d8c56a27a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add hearings.decision_pdf_url (nullable)."""
    with op.batch_alter_table("hearings", schema=None) as batch_op:
        batch_op.add_column(sa.Column("decision_pdf_url", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema: drop hearings.decision_pdf_url."""
    with op.batch_alter_table("hearings", schema=None) as batch_op:
        batch_op.drop_column("decision_pdf_url")
