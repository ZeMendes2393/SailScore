"""protest extras + attachments (safe minimal)"""

from alembic import op
import sqlalchemy as sa

# Revisions
revision = "dd97b9be2332"
down_revision = "839b02d98dd8"
branch_labels = None
depends_on = None


def _col_exists(table: str, col: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        return any(c["name"] == col for c in insp.get_columns(table))
    except Exception:
        return False


def upgrade() -> None:
    # --- PROTESTS: novas colunas/relacionamentos ---
    with op.batch_alter_table("protests", schema=None) as b:
        b.add_column(sa.Column("submitted_snapshot_json", sa.JSON(), nullable=True))
        b.add_column(sa.Column("submitted_pdf_url", sa.String(length=500), nullable=True))
        b.add_column(sa.Column("decision_json", sa.JSON(), nullable=True))
        b.add_column(sa.Column("decision_pdf_url", sa.String(length=500), nullable=True))
        b.add_column(sa.Column("decided_at", sa.DateTime(), nullable=True))
        b.add_column(sa.Column("decided_by_user_id", sa.Integer(), nullable=True))
        b.create_foreign_key(
            "fk_protests_decided_by",
            "users",
            ["decided_by_user_id"],
            ["id"],
        )

    # --- PROTEST_ATTACHMENTS: novos campos (mantendo dados antigos) ---
    # Adiciona novos campos de forma compatível
    with op.batch_alter_table("protest_attachments", schema=None) as b:
        # valores por omissão para não partir linhas antigas
        b.add_column(sa.Column("kind", sa.String(length=50), nullable=False, server_default="admin_upload"))
        b.add_column(sa.Column("content_type", sa.String(length=120), nullable=True))
        b.add_column(sa.Column("size", sa.Integer(), nullable=False, server_default="0"))
        b.add_column(sa.Column("url", sa.String(length=500), nullable=True))  # ficará NOT NULL depois do backfill
        b.add_column(sa.Column("uploaded_by_user_id", sa.Integer(), nullable=True))
        b.add_column(sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")))
        b.create_foreign_key(
            "fk_protest_attachments_user",
            "users",
            ["uploaded_by_user_id"],
            ["id"],
        )

    # Backfill: copiar filepath -> url (se a coluna ainda existir)
    if _col_exists("protest_attachments", "filepath") and _col_exists("protest_attachments", "url"):
        op.execute("UPDATE protest_attachments SET url = filepath WHERE url IS NULL OR url = ''")

    # Agora podemos tornar url NOT NULL
    with op.batch_alter_table("protest_attachments", schema=None) as b:
        b.alter_column("url", existing_type=sa.String(length=500), nullable=False)

    # Opcional: remover colunas antigas se ainda existirem (depois do backfill)
    # Fazemos isto de forma condicional para não partir se já não existirem
    if _col_exists("protest_attachments", "uploaded_at"):
        with op.batch_alter_table("protest_attachments", schema=None) as b:
            b.drop_column("uploaded_at")
    if _col_exists("protest_attachments", "filepath"):
        with op.batch_alter_table("protest_attachments", schema=None) as b:
            b.drop_column("filepath")


def downgrade() -> None:
    # Repor protest_attachments (reverter o NOT NULL de url para ser seguro)
    if _col_exists("protest_attachments", "url"):
        with op.batch_alter_table("protest_attachments", schema=None) as b:
            b.alter_column("url", existing_type=sa.String(length=500), nullable=True)

    with op.batch_alter_table("protest_attachments", schema=None) as b:
        # Remover FK para users (uploaded_by_user_id) antes de dropar a coluna
        try:
            b.drop_constraint("fk_protest_attachments_user", type_="foreignkey")
        except Exception:
            pass
        # Remover colunas novas
        if _col_exists("protest_attachments", "created_at"):
            b.drop_column("created_at")
        if _col_exists("protest_attachments", "uploaded_by_user_id"):
            b.drop_column("uploaded_by_user_id")
        if _col_exists("protest_attachments", "url"):
            b.drop_column("url")
        if _col_exists("protest_attachments", "size"):
            b.drop_column("size")
        if _col_exists("protest_attachments", "content_type"):
            b.drop_column("content_type")
        if _col_exists("protest_attachments", "kind"):
            b.drop_column("kind")

    # Repor protests
    with op.batch_alter_table("protests", schema=None) as b:
        try:
            b.drop_constraint("fk_protests_decided_by", type_="foreignkey")
        except Exception:
            pass
        if _col_exists("protests", "decided_by_user_id"):
            b.drop_column("decided_by_user_id")
        if _col_exists("protests", "decided_at"):
            b.drop_column("decided_at")
        if _col_exists("protests", "decision_pdf_url"):
            b.drop_column("decision_pdf_url")
        if _col_exists("protests", "decision_json"):
            b.drop_column("decision_json")
        if _col_exists("protests", "submitted_pdf_url"):
            b.drop_column("submitted_pdf_url")
        if _col_exists("protests", "submitted_snapshot_json"):
            b.drop_column("submitted_snapshot_json")
