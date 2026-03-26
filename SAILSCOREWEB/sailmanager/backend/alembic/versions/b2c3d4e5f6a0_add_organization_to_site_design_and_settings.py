"""add organization_id to site_design and global_settings

Revision ID: b2c3d4e5f6a0
Revises: a1b2c3d4e5f9
Create Date: 2026-03-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a0"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    default_org = conn.execute(sa.text("SELECT id FROM organizations WHERE slug = 'sailscore'")).fetchone()
    if not default_org:
        raise RuntimeError("Organization 'sailscore' must exist. Run migrations in order.")
    default_org_id = default_org[0]

    # ---- site_design ----
    insp = sa.inspect(conn)
    sd_cols = {c["name"] for c in insp.get_columns("site_design")}
    if "organization_id" not in sd_cols:
        op.add_column("site_design", sa.Column("organization_id", sa.Integer(), nullable=True))
        conn.execute(sa.text("UPDATE site_design SET organization_id = :oid").bindparams(oid=default_org_id))
        with op.batch_alter_table("site_design") as batch:
            batch.alter_column("organization_id", nullable=False)
            batch.create_foreign_key(
                "fk_site_design_organization_id",
                "organizations",
                ["organization_id"],
                ["id"],
                ondelete="CASCADE",
            )
        op.create_index("ix_site_design_organization_id", "site_design", ["organization_id"], unique=True)

    # ---- global_settings ----
    gs_cols = {c["name"] for c in insp.get_columns("global_settings")}
    if "organization_id" not in gs_cols:
        op.drop_index("ix_global_settings_key", table_name="global_settings")
        op.add_column("global_settings", sa.Column("organization_id", sa.Integer(), nullable=True))
        conn.execute(sa.text("UPDATE global_settings SET organization_id = :oid").bindparams(oid=default_org_id))
        with op.batch_alter_table("global_settings") as batch:
            batch.alter_column("organization_id", nullable=False)
            batch.create_foreign_key(
                "fk_global_settings_organization_id",
                "organizations",
                ["organization_id"],
                ["id"],
                ondelete="CASCADE",
            )
            batch.create_unique_constraint("uq_global_settings_org_key", ["organization_id", "key"])
        op.create_index("ix_global_settings_organization_id", "global_settings", ["organization_id"])


def downgrade() -> None:
    op.drop_constraint("uq_global_settings_org_key", "global_settings", type_="unique")
    op.drop_index("ix_global_settings_organization_id", table_name="global_settings")
    with op.batch_alter_table("global_settings") as batch:
        batch.drop_constraint("fk_global_settings_organization_id", type_="foreignkey")
    op.drop_column("global_settings", "organization_id")
    op.create_index("ix_global_settings_key", "global_settings", ["key"], unique=True)

    op.drop_index("ix_site_design_organization_id", table_name="site_design")
    with op.batch_alter_table("site_design") as batch:
        batch.drop_constraint("fk_site_design_organization_id", type_="foreignkey")
    op.drop_column("site_design", "organization_id")
