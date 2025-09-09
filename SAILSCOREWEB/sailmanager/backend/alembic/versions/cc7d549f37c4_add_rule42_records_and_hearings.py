"""add rule42_records and hearings

Revision ID: cc7d549f37c4
Revises: 9f2738668e7a
Create Date: 2025-09-09 11:35:14.762572
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "cc7d549f37c4"
down_revision: Union[str, Sequence[str], None] = "9f2738668e7a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Segurança: se sobrou uma tabela temporária de uma migração falhada do SQLite, apaga-a se existir.
    op.execute('DROP TABLE IF EXISTS "_alembic_tmp_races"')

    # --- rule42_records ---
    op.create_table(
        "rule42_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("regatta_id", sa.Integer(), nullable=False, index=False),
        sa.Column("sail_num", sa.String(length=64), nullable=False),
        sa.Column("penalty_number", sa.String(length=64), nullable=False),
        sa.Column("race", sa.String(length=64), nullable=False),
        sa.Column("group", sa.String(length=64), nullable=True),
        sa.Column("rule", sa.String(length=64), nullable=False, server_default=sa.text("'RRS 42'")),
        sa.Column("comp_action", sa.String(length=128), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("class_name", sa.String(length=64), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(datetime('now'))"), nullable=False),
    )
    op.create_index("ix_rule42_records_regatta_id", "rule42_records", ["regatta_id"])

    # --- hearings ---
    op.create_table(
        "hearings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("regatta_id", sa.Integer(), nullable=False, index=False),
        sa.Column("protest_id", sa.Integer(), nullable=False, index=False),
        sa.Column("case_number", sa.Integer(), nullable=False),
        sa.Column("decision", sa.Text(), nullable=True),
        sa.Column("sch_date", sa.Date(), nullable=True),
        sa.Column("sch_time", sa.Time(), nullable=True),
        sa.Column("room", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'SCHEDULED'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(datetime('now'))"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(datetime('now'))"), nullable=False),
    )
    op.create_index("ix_hearings_regatta_id", "hearings", ["regatta_id"])
    op.create_unique_constraint("uq_hearing_case_per_regatta", "hearings", ["regatta_id", "case_number"])


def downgrade() -> None:
    op.drop_constraint("uq_hearing_case_per_regatta", "hearings", type_="unique")
    op.drop_index("ix_hearings_regatta_id", table_name="hearings")
    op.drop_table("hearings")

    op.drop_index("ix_rule42_records_regatta_id", table_name="rule42_records")
    op.drop_table("rule42_records")
