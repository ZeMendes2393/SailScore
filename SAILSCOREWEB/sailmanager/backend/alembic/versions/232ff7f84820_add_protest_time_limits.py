"""add protest_time_limits

Revision ID: 232ff7f84820
Revises: dd97b9be2332
Create Date: 2025-09-29 19:48:28.256505
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "232ff7f84820"
down_revision: Union[str, Sequence[str], None] = "dd97b9be2332"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(bind, name: str) -> bool:
    insp = sa.inspect(bind)
    return name in insp.get_table_names()


def _has_index(bind, table: str, index_name: str) -> bool:
    insp = sa.inspect(bind)
    try:
        return any(ix.get("name") == index_name for ix in insp.get_indexes(table))
    except Exception:
        return False


def _has_unique(bind, table: str, uq_name: str) -> bool:
    insp = sa.inspect(bind)
    try:
        return any(uq.get("name") == uq_name for uq in insp.get_unique_constraints(table))
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()
    table = "protest_time_limits"
    uq_name = "uq_ptl_regatta_class_fleet_date"
    ix_name = "ix_ptl_regatta_date"

    if not _has_table(bind, table):
        # Criar TABELA já com a UNIQUE embutida (SQLite-friendly)
        op.create_table(
            table,
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("regatta_id", sa.Integer(), nullable=False),
            sa.Column("class_name", sa.String(length=120), nullable=False),
            sa.Column("fleet", sa.String(length=64), nullable=True),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("posting_time", sa.Time(), nullable=True),
            sa.Column("time_limit_minutes", sa.Integer(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["regatta_id"], ["regattas.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("regatta_id", "class_name", "fleet", "date", name=uq_name),
        )

    else:
        # A tabela já existe (ficou criada na tentativa anterior). Garantir a UNIQUE via batch.
        if not _has_unique(bind, table, uq_name):
            with op.batch_alter_table(table) as batch_op:
                batch_op.create_unique_constraint(
                    uq_name, ["regatta_id", "class_name", "fleet", "date"]
                )

    # Índice auxiliar (criar só se não existir)
    if not _has_index(bind, table, ix_name):
        op.create_index(ix_name, table, ["regatta_id", "date"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    table = "protest_time_limits"
    ix_name = "ix_ptl_regatta_date"

    # Em SQLite, dropar a tabela remove os índices, mas se existir o índice com esse nome noutros SGBDs:
    if _has_table(bind, table) and _has_index(bind, table, ix_name):
        op.drop_index(ix_name, table_name=table)

    if _has_table(bind, table):
        op.drop_table(table)
