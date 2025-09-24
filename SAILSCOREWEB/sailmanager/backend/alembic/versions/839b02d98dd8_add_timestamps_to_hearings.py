"""add timestamps to hearings (safe minimal)

Revision ID: 839b02d98dd8
Revises: 8abd4ecb7af5
Create Date: 2025-09-19 15:08:40.939585
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "839b02d98dd8"
down_revision = "8abd4ecb7af5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Limpeza defensiva: se uma tmp ficou para trás numa tentativa anterior, apaga-a
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_hearings")

    with op.batch_alter_table("hearings", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            )
        )
        batch_op.add_column(
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("hearings", schema=None) as batch_op:
        batch_op.drop_column("updated_at")
        batch_op.drop_column("created_at")
