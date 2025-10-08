"""add scoring_enquiries

Revision ID: 077b4bd3012b
Revises: ad449072457f
Create Date: 2025-10-08 00:11:31.354026

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '077b4bd3012b'
down_revision: Union[str, Sequence[str], None] = 'ad449072457f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: create scoring_enquiries table + indexes."""
    op.create_table(
        "scoring_enquiries",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),

        sa.Column("regatta_id", sa.Integer(), sa.ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiator_entry_id", sa.Integer(), sa.ForeignKey("entries.id", ondelete="SET NULL"), nullable=True),

        sa.Column("race_id", sa.Integer(), sa.ForeignKey("races.id", ondelete="SET NULL"), nullable=True),
        sa.Column("race_number", sa.String(), nullable=True),
        sa.Column("class_name", sa.String(), nullable=True),
        sa.Column("sail_number", sa.String(), nullable=True),

        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("requested_change", sa.String(), nullable=True),

        sa.Column("status", sa.String(), nullable=False, server_default=sa.text("'submitted'")),
        sa.Column("admin_note", sa.String(), nullable=True),
        sa.Column("decision_pdf_path", sa.String(), nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # Índices simples
    op.create_index("ix_scoring_enquiries_regatta_id", "scoring_enquiries", ["regatta_id"], unique=False)
    op.create_index("ix_scoring_enquiries_initiator_entry_id", "scoring_enquiries", ["initiator_entry_id"], unique=False)
    op.create_index("ix_scoring_enquiries_race_id", "scoring_enquiries", ["race_id"], unique=False)
    op.create_index("ix_scoring_enquiries_class_name", "scoring_enquiries", ["class_name"], unique=False)
    op.create_index("ix_scoring_enquiries_sail_number", "scoring_enquiries", ["sail_number"], unique=False)
    op.create_index("ix_scoring_enquiries_status", "scoring_enquiries", ["status"], unique=False)

    # Índice composto (regatta_id + status)
    op.create_index("ix_scoring_regatta_status", "scoring_enquiries", ["regatta_id", "status"], unique=False)


def downgrade() -> None:
    """Downgrade schema: drop scoring_enquiries and its indexes."""
    op.drop_index("ix_scoring_regatta_status", table_name="scoring_enquiries")
    op.drop_index("ix_scoring_enquiries_status", table_name="scoring_enquiries")
    op.drop_index("ix_scoring_enquiries_sail_number", table_name="scoring_enquiries")
    op.drop_index("ix_scoring_enquiries_class_name", table_name="scoring_enquiries")
    op.drop_index("ix_scoring_enquiries_race_id", table_name="scoring_enquiries")
    op.drop_index("ix_scoring_enquiries_initiator_entry_id", table_name="scoring_enquiries")
    op.drop_index("ix_scoring_enquiries_regatta_id", table_name="scoring_enquiries")
    op.drop_table("scoring_enquiries")
