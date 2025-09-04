"""add protests tables (idempotent, no races change)

Revision ID: ef919d399974
Revises: 499f381ed0c5
Create Date: 2025-08-29 23:18:58.745394
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "ef919d399974"
down_revision: Union[str, Sequence[str], None] = "499f381ed0c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # --- PROTESTS ---
    if not insp.has_table("protests"):
        op.create_table(
            "protests",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("regatta_id", sa.Integer(), sa.ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("type", sa.String(), nullable=False),
            sa.Column("race_date", sa.String(), nullable=True),
            sa.Column("race_number", sa.String(), nullable=True),
            sa.Column("group_name", sa.String(), nullable=True),
            sa.Column("initiator_entry_id", sa.Integer(), sa.ForeignKey("entries.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("initiator_represented_by", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="submitted"),
            sa.Column("received_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.create_index("ix_protests_regatta_updated", "protests", ["regatta_id", "updated_at"])

    # --- PROTEST_PARTIES ---
    if not insp.has_table("protest_parties"):
        op.create_table(
            "protest_parties",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("protest_id", sa.Integer(), sa.ForeignKey("protests.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("kind", sa.String(), nullable=False, server_default="entry"),  # entry | other
            sa.Column("entry_id", sa.Integer(), sa.ForeignKey("entries.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("free_text", sa.String(), nullable=True),
            sa.Column("represented_by", sa.String(), nullable=True),
        )
        op.create_index("ix_protest_parties_protest", "protest_parties", ["protest_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table("protest_parties"):
        op.drop_index("ix_protest_parties_protest", table_name="protest_parties")
        op.drop_table("protest_parties")

    if insp.has_table("protests"):
        op.drop_index("ix_protests_regatta_updated", table_name="protests")
        op.drop_table("protests")
