"""add organization_id to regattas (multi-org phase A)

Revision ID: a1b2c3d4e5f9
Revises: f9e8d7c6b5a4
Create Date: 2026-03-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f9"
down_revision: Union[str, Sequence[str], None] = "f9e8d7c6b5a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("regattas")}
    has_col = "organization_id" in cols
    fks = insp.get_foreign_keys("regattas")
    has_fk = any("organization_id" in (fk.get("constrained_columns") or []) for fk in fks)

    if has_fk:
        return  # already applied

    if not has_col:
        # 1. Add column as nullable (batch for SQLite)
        with op.batch_alter_table("regattas") as batch_op:
            batch_op.add_column(sa.Column("organization_id", sa.Integer(), nullable=True))
        op.create_index("ix_regattas_organization_id", "regattas", ["organization_id"], unique=False)

    # 2. Create default org and backfill
    r = conn.execute(sa.text("SELECT id FROM organizations WHERE slug = 'sailscore'")).fetchone()
    if r:
        default_org_id = r[0]
    else:
        conn.execute(
            sa.text(
                "INSERT INTO organizations (name, slug, is_active, created_at, updated_at) "
                "VALUES ('SailScore', 'sailscore', 1, datetime('now'), datetime('now'))"
            )
        )
        r = conn.execute(sa.text("SELECT last_insert_rowid()")).fetchone()
        default_org_id = r[0]

    conn.execute(
        sa.text("UPDATE regattas SET organization_id = :oid WHERE organization_id IS NULL").bindparams(
            oid=default_org_id
        )
    )

    # 3. Make column NOT NULL and add FK (batch required for SQLite)
    with op.batch_alter_table("regattas") as batch_op:
        batch_op.alter_column(
            "organization_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.create_foreign_key(
            "fk_regattas_organization_id",
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="RESTRICT",
        )


def downgrade() -> None:
    op.drop_constraint("fk_regattas_organization_id", "regattas", type_="foreignkey")
    op.drop_index("ix_regattas_organization_id", table_name="regattas")
    op.drop_column("regattas", "organization_id")
