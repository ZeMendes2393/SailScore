from alembic import op
import sqlalchemy as sa

revision = '048636166b46'
down_revision = '2f5db69e74a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "regattas" not in insp.get_table_names():
        return
    existing_cols = {c["name"] for c in insp.get_columns("regattas")}

    with op.batch_alter_table('regattas') as batch_op:
        if "discard_count" not in existing_cols:
            batch_op.add_column(
                sa.Column('discard_count', sa.Integer(), nullable=False, server_default='0')
            )
        if "discard_threshold" not in existing_cols:
            batch_op.add_column(
                sa.Column('discard_threshold', sa.Integer(), nullable=False, server_default='4')
            )

    if bind.dialect.name != "sqlite":
        existing_cols = {c["name"] for c in insp.get_columns("regattas")}
        if "discard_count" in existing_cols and "discard_threshold" in existing_cols:
            with op.batch_alter_table('regattas') as batch_op:
                batch_op.alter_column('discard_count', server_default=None)
                batch_op.alter_column('discard_threshold', server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "regattas" not in insp.get_table_names():
        return
    existing_cols = {c["name"] for c in insp.get_columns("regattas")}

    with op.batch_alter_table('regattas') as batch_op:
        if "discard_threshold" in existing_cols:
            batch_op.drop_column('discard_threshold')
        if "discard_count" in existing_cols:
            batch_op.drop_column('discard_count')
