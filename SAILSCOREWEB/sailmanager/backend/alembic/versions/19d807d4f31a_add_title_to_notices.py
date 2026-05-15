"""add title to notices

Revision ID: 19d807d4f31a
Revises: 3d6fd3b22a5f
Create Date: 2025-07-03 16:56:01.029346

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '19d807d4f31a'
down_revision: Union[str, Sequence[str], None] = '3d6fd3b22a5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "notices" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("notices")}
    if "title" not in cols:
        op.add_column(
            "notices",
            sa.Column("title", sa.String(), nullable=False, server_default="Sem título"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "notices" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("notices")}
    if "title" in cols:
        op.drop_column("notices", "title")
