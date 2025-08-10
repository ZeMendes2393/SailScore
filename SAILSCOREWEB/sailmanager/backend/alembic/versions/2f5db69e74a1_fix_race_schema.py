"""fix race schema

Revision ID: 2f5db69e74a1
Revises: 95255940a8bd
Create Date: 2025-08-05 00:16:11.375525

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2f5db69e74a1'
down_revision: Union[str, Sequence[str], None] = '95255940a8bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
