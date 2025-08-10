"""add date to Race

Revision ID: 95255940a8bd
Revises: 1852cf559e15
Create Date: 2025-08-03 XX:XX:XX.XXX

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '95255940a8bd'
down_revision = '1852cf559e15'
branch_labels = None
depends_on = None


def upgrade():
    # ESTA LINHA DÁ ERRO — REMOVE!
    # op.add_column('races', sa.Column('date', sa.String(), nullable=True))
    pass


def downgrade():
    # op.drop_column('races', 'date')
    pass
