"""add scoring_codes to regattas and code to results

Revision ID: e6babc444ddb
Revises: cdcb3d9b2fa2
Create Date: 2025-08-20 14:02:26.071822
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e6babc444ddb"
down_revision: Union[str, Sequence[str], None] = "cdcb3d9b2fa2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    insp = sa.inspect(bind)

    if dialect == "postgresql":
        json_type = postgresql.JSONB
    else:
        json_type = sa.JSON if hasattr(sa, "JSON") else sa.Text

    if "regattas" in insp.get_table_names():
        regatta_cols = {c["name"] for c in insp.get_columns("regattas")}
        if "scoring_codes" not in regatta_cols:
            op.add_column("regattas", sa.Column("scoring_codes", json_type, nullable=True))

    if "results" in insp.get_table_names():
        result_cols = {c["name"] for c in insp.get_columns("results")}
        if "code" not in result_cols:
            op.add_column("results", sa.Column("code", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "results" in insp.get_table_names():
        result_cols = {c["name"] for c in insp.get_columns("results")}
        if "code" in result_cols:
            op.drop_column("results", "code")

    if "regattas" in insp.get_table_names():
        regatta_cols = {c["name"] for c in insp.get_columns("regattas")}
        if "scoring_codes" in regatta_cols:
            op.drop_column("regattas", "scoring_codes")
