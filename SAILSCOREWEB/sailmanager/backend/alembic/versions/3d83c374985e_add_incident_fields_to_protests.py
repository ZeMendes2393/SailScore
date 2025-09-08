from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "3d83c374985e"
down_revision = "ef919d399974"
branch_labels = None
depends_on = None


def _get_columns(table_name: str):
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return {c["name"] for c in insp.get_columns(table_name)}


def upgrade() -> None:
    cols = _get_columns("protests")
    with op.batch_alter_table("protests") as batch_op:
        if "incident_when_where" not in cols:
            batch_op.add_column(sa.Column("incident_when_where", sa.Text(), nullable=True))
        if "incident_description" not in cols:
            batch_op.add_column(sa.Column("incident_description", sa.Text(), nullable=True))
        if "rules_alleged" not in cols:
            batch_op.add_column(sa.Column("rules_alleged", sa.Text(), nullable=True))


def downgrade() -> None:
    cols = _get_columns("protests")
    with op.batch_alter_table("protests") as batch_op:
        if "rules_alleged" in cols:
            batch_op.drop_column("rules_alleged")
        if "incident_description" in cols:
            batch_op.drop_column("incident_description")
        if "incident_when_where" in cols:
            batch_op.drop_column("incident_when_where")
