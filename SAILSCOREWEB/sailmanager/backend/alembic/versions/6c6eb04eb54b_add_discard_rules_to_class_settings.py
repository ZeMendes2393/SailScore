"""add_discard_rules_to_class_settings

Revision ID: 6c6eb04eb54b
Revises: e52ff29bbd82
Create Date: 2026-01-05 01:57:27.805880

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6c6eb04eb54b"
down_revision: Union[str, Sequence[str], None] = "e52ff29bbd82"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite-friendly: altera tabela em batch
    with op.batch_alter_table("regatta_class_settings") as batch_op:
        batch_op.add_column(sa.Column("discard_rules", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("regatta_class_settings") as batch_op:
        batch_op.drop_column("discard_rules")
