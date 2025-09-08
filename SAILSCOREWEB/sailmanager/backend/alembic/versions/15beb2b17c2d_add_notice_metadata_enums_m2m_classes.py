"""add notice metadata, enums, m2m classes (idempotent)"""

from alembic import op
import sqlalchemy as sa


revision = "15beb2b17c2d"
down_revision = "3d83c374985e"
branch_labels = None
depends_on = None


def _insp():
    return sa.inspect(op.get_bind())


def _cols(table):
    try:
        return {c["name"] for c in _insp().get_columns(table)}
    except Exception:
        return set()


def _indexes(table):
    try:
        return {ix["name"] for ix in _insp().get_indexes(table)}
    except Exception:
        return set()


def _tables():
    try:
        return set(_insp().get_table_names())
    except Exception:
        return set()


def upgrade():
    cols = _cols("notices")

    # --- NOTICES: adicionar colunas só se faltarem ---
    if "published_at" not in cols:
        op.add_column(
            "notices",
            sa.Column(
                "published_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    if "source" not in cols:
        notice_source = sa.Enum(
            "ORGANIZING_AUTHORITY",
            "RACE_COMMITTEE",
            "JURY",
            "TECHNICAL_COMMITTEE",
            "OTHER",
            name="notice_source",
            native_enum=False,
        )
        op.add_column(
            "notices",
            sa.Column("source", notice_source, nullable=False, server_default="OTHER"),
        )

    if "doc_type" not in cols:
        notice_doc_type = sa.Enum(
            "RACE_DOCUMENT",
            "RULE_42",
            "JURY_DOC",
            "TECHNICAL",
            "OTHER",
            name="notice_doc_type",
            native_enum=False,
        )
        op.add_column(
            "notices",
            sa.Column(
                "doc_type",
                notice_doc_type,
                nullable=False,
                server_default="RACE_DOCUMENT",
            ),
        )

    if "is_important" not in cols:
        op.add_column(
            "notices",
            sa.Column("is_important", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )

    if "applies_to_all" not in cols:
        op.add_column(
            "notices",
            sa.Column("applies_to_all", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        )

    # Índice composto
    n_ix = _indexes("notices")
    if "ix_notices_regatta_published" not in n_ix and "published_at" in _cols("notices"):
        op.create_index(
            "ix_notices_regatta_published",
            "notices",
            ["regatta_id", "published_at"],
            unique=False,
        )

    # --- Tabela ponte Notice ⟷ RegattaClass ---
    if "notice_classes" not in _tables():
        op.create_table(
            "notice_classes",
            sa.Column(
                "notice_id",
                sa.Integer(),
                sa.ForeignKey("notices.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column(
                "regatta_class_id",
                sa.Integer(),
                sa.ForeignKey("regatta_classes.id", ondelete="CASCADE"),
                primary_key=True,
            ),
        )
        op.create_index("ix_notice_classes_notice", "notice_classes", ["notice_id"], unique=False)
        op.create_index(
            "ix_notice_classes_regatta_class", "notice_classes", ["regatta_class_id"], unique=False
        )
    else:
        nc_ix = _indexes("notice_classes")
        if "ix_notice_classes_notice" not in nc_ix:
            op.create_index("ix_notice_classes_notice", "notice_classes", ["notice_id"], unique=False)
        if "ix_notice_classes_regatta_class" not in nc_ix:
            op.create_index(
                "ix_notice_classes_regatta_class", "notice_classes", ["regatta_class_id"], unique=False
            )


def downgrade():
    # Tabela ponte + índices
    if "notice_classes" in _tables():
        nc_ix = _indexes("notice_classes")
        if "ix_notice_classes_regatta_class" in nc_ix:
            op.drop_index("ix_notice_classes_regatta_class", table_name="notice_classes")
        if "ix_notice_classes_notice" in nc_ix:
            op.drop_index("ix_notice_classes_notice", table_name="notice_classes")
        op.drop_table("notice_classes")

    # Índice notices
    if "ix_notices_regatta_published" in _indexes("notices"):
        op.drop_index("ix_notices_regatta_published", table_name="notices")

    # Colunas em ordem inversa (só se existirem)
    cols = _cols("notices")
    with op.batch_alter_table("notices") as batch_op:
        if "applies_to_all" in cols:
            batch_op.drop_column("applies_to_all")
        if "is_important" in cols:
            batch_op.drop_column("is_important")
        if "doc_type" in cols:
            batch_op.drop_column("doc_type")
        if "source" in cols:
            batch_op.drop_column("source")
        if "published_at" in cols:
            batch_op.drop_column("published_at")

    # Limpar tipos enum (seguro em Postgres; inócuo em SQLite)
    try:
        sa.Enum(name="notice_doc_type").drop(op.get_bind(), checkfirst=True)
    except Exception:
        pass
    try:
        sa.Enum(name="notice_source").drop(op.get_bind(), checkfirst=True)
    except Exception:
        pass
