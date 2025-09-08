"""merge stub 'add_incident_fields_to_protests' with main head

Revision ID: 9f2738668e7a
Revises: 15beb2b17c2d, add_incident_fields_to_protests
Create Date: 2025-09-07 01:54:56.118263

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f2738668e7a'
down_revision: Union[str, Sequence[str], None] = ('15beb2b17c2d', 'add_incident_fields_to_protests')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
