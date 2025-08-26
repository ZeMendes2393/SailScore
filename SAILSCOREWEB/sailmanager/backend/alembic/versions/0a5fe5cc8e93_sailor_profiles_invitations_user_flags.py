"""sailor_profiles + invitations + user_flags

Revision ID: 0a5fe5cc8e93
Revises: fd8eb4254add
Create Date: 2025-08-25 23:21:55.255964

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0a5fe5cc8e93'
down_revision: Union[str, Sequence[str], None] = 'fd8eb4254add'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
