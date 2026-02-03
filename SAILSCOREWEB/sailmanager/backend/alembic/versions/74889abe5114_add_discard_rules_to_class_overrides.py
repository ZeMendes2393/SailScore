"""add discard rules to class overrides

Revision ID: 74889abe5114
Revises: 6c6eb04eb54b
Create Date: 2026-01-05 02:15:29.359796

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "74889abe5114"
down_revision: Union[str, Sequence[str], None] = "6c6eb04eb54b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("regatta_class_settings") as batch:
        batch.add_column(sa.Column("discard_rules", sa.JSON(), nullable=True))
        batch.add_column(
            sa.Column(
                "discard_rules_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("1"),
            )
        )
        batch.add_column(sa.Column("discard_rules_label", sa.String(length=120), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("regatta_class_settings") as batch:
        batch.drop_column("discard_rules_label")
        batch.drop_column("discard_rules_active")
        batch.drop_column("discard_rules")
