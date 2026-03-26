"""add organization_id to regatta_sponsors (clean database per org)

Revision ID: d4e5f6a7b8c2
Revises: c3d4e5f6a7b1
Create Date: 2026-03-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c2"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("regatta_sponsors")}
    if "organization_id" in cols:
        return

    default_org = conn.execute(sa.text("SELECT id FROM organizations WHERE slug = 'sailscore'")).fetchone()
    if not default_org:
        raise RuntimeError("Organization 'sailscore' must exist.")
    default_org_id = default_org[0]

    with op.batch_alter_table("regatta_sponsors") as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.Integer(), nullable=True))

    # Backfill: regatta-specific -> from regatta; global (regatta_id NULL) -> sailscore
    conn.execute(
        sa.text("""
            UPDATE regatta_sponsors
            SET organization_id = COALESCE(
                (SELECT organization_id FROM regattas WHERE regattas.id = regatta_sponsors.regatta_id),
                :oid
            )
            WHERE organization_id IS NULL
        """).bindparams(oid=default_org_id)
    )

    with op.batch_alter_table("regatta_sponsors") as batch_op:
        batch_op.alter_column("organization_id", nullable=False)
        batch_op.create_foreign_key(
            "fk_regatta_sponsors_organization_id",
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="CASCADE",
        )
    op.create_index("ix_regatta_sponsors_organization_id", "regatta_sponsors", ["organization_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_regatta_sponsors_organization_id", table_name="regatta_sponsors")
    with op.batch_alter_table("regatta_sponsors") as batch_op:
        batch_op.drop_constraint("fk_regatta_sponsors_organization_id", type_="foreignkey")
        batch_op.drop_column("organization_id")
