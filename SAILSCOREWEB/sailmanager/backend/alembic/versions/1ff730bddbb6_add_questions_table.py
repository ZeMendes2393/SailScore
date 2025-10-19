"""add questions table

Revision ID: 1ff730bddbb6
Revises: f09961f2e4ff
Create Date: 2025-10-15 21:03:07.740542

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1ff730bddbb6"
down_revision: Union[str, Sequence[str], None] = "f09961f2e4ff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    status_enum = sa.Enum("open", "answered", "closed", name="questionstatus")
    visibility_enum = sa.Enum("public", "private", name="questionvisibility")

    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("regatta_id", sa.Integer(), sa.ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seq_no", sa.Integer(), nullable=False),
        sa.Column("class_name", sa.String(80), nullable=False),
        sa.Column("sail_number", sa.String(40), nullable=False),
        sa.Column("sailor_name", sa.String(160), nullable=False),
        sa.Column("subject", sa.String(160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", status_enum, nullable=False, server_default="open"),
        sa.Column("visibility", visibility_enum, nullable=False, server_default="private"),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("answered_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # ---- PÕE A UNIQUE AQUI (SQLite-friendly) ----
        sa.UniqueConstraint("regatta_id", "seq_no", name="uq_questions_regatta_seq"),
    )

    # Índices (ok em SQLite)
    op.create_index("ix_questions_regatta_status", "questions", ["regatta_id", "status"])
    op.create_index("ix_questions_regatta_visibility", "questions", ["regatta_id", "visibility"])


def downgrade() -> None:
    op.drop_index("ix_questions_regatta_visibility", table_name="questions")
    op.drop_index("ix_questions_regatta_status", table_name="questions")
    op.drop_table("questions")

    # Em PostgreSQL, remover os tipos Enum nomeados (inócuo em SQLite)
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS questionstatus")
        op.execute("DROP TYPE IF EXISTS questionvisibility")
