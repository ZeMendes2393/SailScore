"""regatta.online_entry_open + entry_attachments

Revision ID: 0f9ba055fbab
Revises: 972181347b09
Create Date: 2025-10-19 18:48:30.869792
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0f9ba055fbab"
down_revision: Union[str, Sequence[str], None] = "972181347b09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return table_name in insp.get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(col["name"] == column_name for col in insp.get_columns(table_name))


def _has_index(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(ix["name"] == index_name for ix in insp.get_indexes(table_name))


def upgrade() -> None:
    # 1) Adicionar campo às regatas (com guard)
    if not _has_column("regattas", "online_entry_open"):
        op.add_column(
            "regattas",
            sa.Column("online_entry_open", sa.Boolean(), nullable=False, server_default="1"),
        )

    # 2) Criar tabela de anexos por inscrição (com guard)
    if not _has_table("entry_attachments"):
        op.create_table(
            "entry_attachments",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column(
                "entry_id",
                sa.Integer(),
                sa.ForeignKey("entries.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("content_type", sa.String(length=100), nullable=False, server_default="application/pdf"),
            sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
            sa.Column("visible_to_sailor", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("original_filename", sa.String(length=255), nullable=False),
            sa.Column("storage_path", sa.String(length=512), nullable=False),
            sa.Column("public_path", sa.String(length=512), nullable=False),
            sa.Column("uploaded_by_id", sa.Integer(), nullable=True),
            sa.Column("uploaded_by_name", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("(datetime('now'))")),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    # 3) Índices (com guard; caso a tabela já existisse)
    if _has_table("entry_attachments"):
        if not _has_index("entry_attachments", "ix_entry_attachments_id"):
            op.create_index("ix_entry_attachments_id", "entry_attachments", ["id"])
        if not _has_index("entry_attachments", "ix_entry_attachments_entry_id"):
            op.create_index("ix_entry_attachments_entry_id", "entry_attachments", ["entry_id"])


def downgrade() -> None:
    # Remover índices se existirem
    if _has_table("entry_attachments"):
        if _has_index("entry_attachments", "ix_entry_attachments_entry_id"):
            op.drop_index("ix_entry_attachments_entry_id", table_name="entry_attachments")
        if _has_index("entry_attachments", "ix_entry_attachments_id"):
            op.drop_index("ix_entry_attachments_id", table_name="entry_attachments")

        # Dropar tabela (sem IF EXISTS nativo; protegemos com guard)
        op.drop_table("entry_attachments")

    # Remover coluna se existir
    if _has_column("regattas", "online_entry_open"):
        op.drop_column("regattas", "online_entry_open")
