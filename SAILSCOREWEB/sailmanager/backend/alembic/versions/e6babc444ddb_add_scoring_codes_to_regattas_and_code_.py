"""add scoring_codes to regattas and code to results

Revision ID: e6babc444ddb
Revises: cdcb3d9b2fa2
Create Date: 2025-08-20 14:02:26.071822
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e6babc444ddb"
down_revision: Union[str, Sequence[str], None] = "cdcb3d9b2fa2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Escolher tipo JSON adequado por dialect
    if dialect == "postgresql":
        json_type = postgresql.JSONB
    else:
        # Em SQLite, sa.JSON mapeia para TEXT — serve para nós
        json_type = sa.JSON if hasattr(sa, "JSON") else sa.Text

    # ADIÇÃO SIMPLES DE COLUNAS (sem batch, sem FKs/índices)
    op.add_column("regattas", sa.Column("scoring_codes", json_type, nullable=True))
    op.add_column("results", sa.Column("code", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("results", "code")
    op.drop_column("regattas", "scoring_codes")
