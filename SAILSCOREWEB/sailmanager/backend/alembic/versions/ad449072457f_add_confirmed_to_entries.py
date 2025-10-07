"""add confirmed to entries

Revision ID: ad449072457f
Revises: b9a6f12f4c3a
Create Date: 2025-10-07 00:37:25.477147
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "ad449072457f"
down_revision: Union[str, Sequence[str], None] = "b9a6f12f4c3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add entries.confirmed with default False; seed paid->confirmed."""
    # 1) adicionar a coluna com default no servidor para preencher linhas existentes
    op.add_column(
        "entries",
        sa.Column("confirmed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )

    # 2) (opcional) seed: marcar confirmadas as inscrições já pagas
    op.execute("UPDATE entries SET confirmed = 1 WHERE paid = 1")

    # 3) remover o server_default em motores que suportam (SQLite não lida bem com alter default)
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.alter_column("entries", "confirmed", server_default=None)


def downgrade() -> None:
    """Downgrade schema: drop entries.confirmed."""
    op.drop_column("entries", "confirmed")
