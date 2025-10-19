"""create regatta_counters and requests

Revision ID: f09961f2e4ff
Revises: 94bb3a6cfa5d
Create Date: 2025-10-10 23:43:35.870811
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "f09961f2e4ff"
down_revision: Union[str, Sequence[str], None] = "94bb3a6cfa5d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ------------------------------
    # Tabela: regatta_counters
    # ------------------------------
    op.create_table(
        "regatta_counters",
        sa.Column("regatta_id", sa.Integer(), nullable=False),
        sa.Column("request_seq", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["regatta_id"], ["regattas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("regatta_id"),
    )

    # ------------------------------
    # Tabela: requests
    # ------------------------------
    op.create_table(
        "requests",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("regatta_id", sa.Integer(), nullable=False),
        sa.Column("initiator_entry_id", sa.Integer(), nullable=True),
        # snapshot do sailor
        sa.Column("class_name", sa.String(), nullable=True),
        sa.Column("sail_number", sa.String(), nullable=True),
        sa.Column("sailor_name", sa.String(), nullable=True),
        # conteúdo
        sa.Column("request_text", sa.String(), nullable=False),
        # fluxo
        sa.Column("status", sa.String(), nullable=False, server_default="submitted"),
        sa.Column("admin_response", sa.String(), nullable=True),
        # numeração por regata
        sa.Column("request_no", sa.Integer(), nullable=False),
        # timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        # FKs
        sa.ForeignKeyConstraint(["regatta_id"], ["regattas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["initiator_entry_id"], ["entries.id"], ondelete="SET NULL"),
        # unicidade por regata
        sa.UniqueConstraint("regatta_id", "request_no", name="uq_requests_regatta_requestno"),
    )

    # Índices úteis
    op.create_index("ix_requests_regatta_id", "requests", ["regatta_id"])
    op.create_index("ix_requests_initiator_entry_id", "requests", ["initiator_entry_id"])
    op.create_index("ix_requests_class_name", "requests", ["class_name"])
    op.create_index("ix_requests_sail_number", "requests", ["sail_number"])
    op.create_index("ix_requests_status", "requests", ["status"])
    op.create_index("ix_requests_request_no", "requests", ["request_no"])

    # ------------------------------
    # Seed: inicializar counters a 0 para regatas existentes
    # ------------------------------
    bind = op.get_bind()
    bind.exec_driver_sql(
        """
        INSERT INTO regatta_counters (regatta_id, request_seq)
        SELECT r.id, 0
        FROM regattas r
        WHERE NOT EXISTS (
            SELECT 1 FROM regatta_counters rc WHERE rc.regatta_id = r.id
        )
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_requests_request_no", table_name="requests")
    op.drop_index("ix_requests_status", table_name="requests")
    op.drop_index("ix_requests_sail_number", table_name="requests")
    op.drop_index("ix_requests_class_name", table_name="requests")
    op.drop_index("ix_requests_initiator_entry_id", table_name="requests")
    op.drop_index("ix_requests_regatta_id", table_name="requests")
    op.drop_table("requests")
    op.drop_table("regatta_counters")
