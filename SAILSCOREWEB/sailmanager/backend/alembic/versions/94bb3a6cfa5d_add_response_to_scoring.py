"""add response to scoring_enquiries

Revision ID: 94bb3a6cfa5d
Revises: 92b9b696efe5
Create Date: 2025-10-09 21:29:00.639723
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "94bb3a6cfa5d"
down_revision: Union[str, Sequence[str], None] = "92b9b696efe5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "scoring_enquiries",
        sa.Column("response", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("scoring_enquiries", "response")
