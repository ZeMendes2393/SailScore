"""update scoring_enquiries fields

Revision ID: 92b9b696efe5
Revises: 077b4bd3012b
Create Date: 2025-10-08 23:19:02.221742

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '92b9b696efe5'
down_revision: Union[str, Sequence[str], None] = '077b4bd3012b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add requested_score/boat_ahead/boat_behind and drop reason."""
    # Em SQLite, usar batch_alter_table para operações seguras
    with op.batch_alter_table('scoring_enquiries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('requested_score', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('boat_ahead', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('boat_behind', sa.String(), nullable=True))
        # remover reason (deixa de ser usada)
        batch_op.drop_column('reason')


def downgrade() -> None:
    """Downgrade schema: restore reason and remove the new fields."""
    with op.batch_alter_table('scoring_enquiries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reason', sa.String(), nullable=True))
        batch_op.drop_column('boat_behind')
        batch_op.drop_column('boat_ahead')
        batch_op.drop_column('requested_score')
