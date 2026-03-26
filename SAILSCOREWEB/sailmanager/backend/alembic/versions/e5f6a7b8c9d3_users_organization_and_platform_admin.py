"""users: organization_id + platform_admin; unique (org, email/username)

Revision ID: e5f6a7b8c9d3
Revises: d4e5f6a7b8c2
Create Date: 2026-03-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d3"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("users")}
    if "organization_id" in cols:
        return

    r = conn.execute(sa.text("SELECT id FROM organizations WHERE slug = 'sailscore'")).fetchone()
    if not r:
        raise RuntimeError("Organization 'sailscore' must exist.")
    sailscore_id = r[0]

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.Integer(), nullable=True))

    with op.batch_alter_table("users") as batch_op:
        batch_op.create_foreign_key(
            "fk_users_organization_id",
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="RESTRICT",
        )

    conn.execute(
        sa.text("UPDATE users SET organization_id = :oid WHERE organization_id IS NULL").bindparams(oid=sailscore_id)
    )

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("organization_id", nullable=False)

    # admin da plataforma (legado) -> platform_admin
    conn.execute(sa.text("UPDATE users SET role = 'platform_admin' WHERE role = 'admin'"))

    # remover índices únicos antigos em email/username
    try:
        op.drop_index("ix_users_email", table_name="users")
    except Exception:
        pass
    try:
        op.drop_index("uq_users_username", table_name="users")
    except Exception:
        pass

    op.create_index("ix_users_organization_id", "users", ["organization_id"], unique=False)
    op.create_index("uq_users_org_email", "users", ["organization_id", "email"], unique=True)
    op.create_index("uq_users_org_username", "users", ["organization_id", "username"], unique=True)


def downgrade() -> None:
    try:
        op.drop_index("uq_users_org_username", table_name="users")
    except Exception:
        pass
    try:
        op.drop_index("uq_users_org_email", table_name="users")
    except Exception:
        pass
    try:
        op.drop_index("ix_users_organization_id", table_name="users")
    except Exception:
        pass
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("fk_users_organization_id_organizations", type_="foreignkey")
        batch_op.drop_column("organization_id")
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("uq_users_username", "users", ["username"], unique=True)
