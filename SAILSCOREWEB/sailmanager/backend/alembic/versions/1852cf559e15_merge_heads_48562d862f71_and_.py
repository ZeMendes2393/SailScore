"""merge heads 48562d862f71 and 8b275a46eb39

Revision ID: 1852cf559e15
Revises: 48562d862f71, 8b275a46eb39
Create Date: 2025-07-14 18:12:41.642928

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1852cf559e15'
down_revision: Union[str, Sequence[str], None] = ('48562d862f71', '8b275a46eb39')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
