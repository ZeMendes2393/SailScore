"""Fix fleet_sets is_published default

Revision ID: e52ff29bbd82
Revises: 1e068eeab62c
Create Date: 2025-12-28 02:52:24.369933

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e52ff29bbd82"
down_revision: Union[str, Sequence[str], None] = "1e068eeab62c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Corrigir dados antigos (casos comuns em SQLite)
    #    - is_published pode estar NULL
    #    - ou pode ter sido guardado como texto 'false'
    op.execute(
        """
        UPDATE fleet_sets
        SET is_published = 0
        WHERE is_published IS NULL
           OR is_published IN ('false','False','FALSE')
        """
    )

    # 2) Garantir default correto na BD (SQLite precisa de batch_alter_table)
    with op.batch_alter_table("fleet_sets") as batch:
        batch.alter_column(
            "is_published",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),  # equivalente ao false em SQLite
        )


def downgrade() -> None:
    # Reverter apenas o default (não mexe nos dados)
    with op.batch_alter_table("fleet_sets") as batch:
        batch.alter_column(
            "is_published",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=None,
        )
