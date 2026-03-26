"""add organization_id to news_items (clean database per org)

Revision ID: c3d4e5f6a7b1
Revises: b2c3d4e5f6a0
Create Date: 2026-03-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b1"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    default_org = conn.execute(sa.text("SELECT id FROM organizations WHERE slug = 'sailscore'")).fetchone()
    if not default_org:
        raise RuntimeError("Organization 'sailscore' must exist.")
    default_org_id = default_org[0]

    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("news_items")}
    if "organization_id" not in cols:
        op.add_column("news_items", sa.Column("organization_id", sa.Integer(), nullable=True))
        conn.execute(sa.text("UPDATE news_items SET organization_id = :oid").bindparams(oid=default_org_id))
        with op.batch_alter_table("news_items") as batch:
            batch.alter_column("organization_id", nullable=False)
            batch.create_foreign_key(
                "fk_news_items_organization_id",
                "organizations",
                ["organization_id"],
                ["id"],
                ondelete="CASCADE",
            )
        op.create_index("ix_news_items_organization_id", "news_items", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_news_items_organization_id", table_name="news_items")
    with op.batch_alter_table("news_items") as batch:
        batch.drop_constraint("fk_news_items_organization_id", type_="foreignkey")
    op.drop_column("news_items", "organization_id")
