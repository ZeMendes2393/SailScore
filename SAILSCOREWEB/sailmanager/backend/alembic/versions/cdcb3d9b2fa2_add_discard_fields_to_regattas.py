from alembic import op
import sqlalchemy as sa

revision = "cdcb3d9b2fa2"
down_revision = "048636166b46"
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_cols = {c["name"] for c in insp.get_columns("regattas")}

    # usar batch para compatibilidade SQLite
    with op.batch_alter_table("regattas") as batch_op:
        if "discard_count" not in existing_cols:
            batch_op.add_column(
                sa.Column("discard_count", sa.Integer(), nullable=False, server_default="0")
            )
        if "discard_threshold" not in existing_cols:
            batch_op.add_column(
                sa.Column("discard_threshold", sa.Integer(), nullable=False, server_default="4")
            )

def downgrade():
    # Nota: faz drop só se existir (para segurança)
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_cols = {c["name"] for c in insp.get_columns("regattas")}

    with op.batch_alter_table("regattas") as batch_op:
        if "discard_threshold" in existing_cols:
            batch_op.drop_column("discard_threshold")
        if "discard_count" in existing_cols:
            batch_op.drop_column("discard_count")
