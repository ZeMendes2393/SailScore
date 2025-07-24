"""add date to Race

Revision ID: 95255940a8bd
Revises: 1852cf559e15
Create Date: 2025-07-14 20:19:42.149347
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '95255940a8bd'
down_revision: Union[str, Sequence[str], None] = '1852cf559e15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Adiciona a coluna 'date' à tabela 'races'
    op.add_column('races', sa.Column('date', sa.String(), nullable=True))

    # Alterações na tabela 'results' usando batch mode
    with op.batch_alter_table('results', schema=None) as batch_op:
        batch_op.create_foreign_key(None, 'races', ['race_id'], ['id'])
        batch_op.drop_column('helm_name')
        batch_op.drop_column('boat_class')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('results', schema=None) as batch_op:
        batch_op.add_column(sa.Column('boat_class', sa.VARCHAR(), nullable=True))
        batch_op.add_column(sa.Column('helm_name', sa.VARCHAR(), nullable=True))
        batch_op.drop_constraint(None, type_='foreignkey')

    op.drop_column('races', 'date')
