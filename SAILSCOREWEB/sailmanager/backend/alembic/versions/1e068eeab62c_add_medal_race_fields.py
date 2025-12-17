"""Add medal race fields

Revision ID: 1e068eeab62c
Revises: fa749dd8daec
Create Date: 2025-12-17 01:40:34.830624
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1e068eeab62c'
down_revision: Union[str, Sequence[str], None] = 'fa749dd8daec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Apenas adicionar os campos da medal race à tabela races
    with op.batch_alter_table('races', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'is_medal_race',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false()
            )
        )
        batch_op.add_column(
            sa.Column(
                'double_points',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false()
            )
        )
        batch_op.add_column(
            sa.Column(
                'discardable',
                sa.Boolean(),
                nullable=False,
                server_default=sa.true()
            )
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('races', schema=None) as batch_op:
        batch_op.drop_column('discardable')
        batch_op.drop_column('double_points')
        batch_op.drop_column('is_medal_race')
