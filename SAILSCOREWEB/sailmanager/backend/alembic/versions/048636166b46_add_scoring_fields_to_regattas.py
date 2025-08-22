from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '048636166b46'
down_revision = '2f5db69e74a1'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # usar batch_alter_table para SQLite
    with op.batch_alter_table('regattas') as batch_op:
        batch_op.add_column(sa.Column('discard_count', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('discard_threshold', sa.Integer(), nullable=False, server_default='4'))

    # remover server_default (opcional, só para deixar “limpo”)
    with op.batch_alter_table('regattas') as batch_op:
        batch_op.alter_column('discard_count', server_default=None)
        batch_op.alter_column('discard_threshold', server_default=None)


def downgrade() -> None:
    with op.batch_alter_table('regattas') as batch_op:
        batch_op.drop_column('discard_threshold')
        batch_op.drop_column('discard_count')
