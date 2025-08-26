"""add users.is_active + email_verified_at + invitations + sailor_profiles

Revision ID: 499f381ed0c5
Revises: 0a5fe5cc8e93
Create Date: 2025-08-26 15:58:05.752770

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '499f381ed0c5'
down_revision: Union[str, Sequence[str], None] = '0a5fe5cc8e93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 0) Limpa lixo de tentativas anteriores (SQLite batch) se existir
    if insp.has_table("_alembic_tmp_users"):
        op.execute("DROP TABLE _alembic_tmp_users")

    # 1) USERS: adiciona colunas apenas se faltarem (sem batch, via ALTER TABLE)
    user_cols = {c["name"] for c in insp.get_columns("users")}

    if "is_active" not in user_cols:
        op.execute(sa.text("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))

    if "email_verified_at" not in user_cols:
        op.execute(sa.text("ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL"))

    # 2) SAILOR PROFILES: cria só se não existir
    if not insp.has_table("sailor_profiles"):
        op.create_table(
            "sailor_profiles",
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("first_name", sa.String(), nullable=True),
            sa.Column("last_name", sa.String(), nullable=True),
            sa.Column("date_of_birth", sa.String(), nullable=True),
            sa.Column("gender", sa.String(), nullable=True),
            sa.Column("club", sa.String(), nullable=True),
            sa.Column("contact_phone_1", sa.String(), nullable=True),
            sa.Column("contact_phone_2", sa.String(), nullable=True),
            sa.Column("address", sa.String(), nullable=True),
            sa.Column("zip_code", sa.String(), nullable=True),
            sa.Column("town", sa.String(), nullable=True),
            sa.Column("country", sa.String(), nullable=True),
            sa.Column("country_secondary", sa.String(), nullable=True),
            sa.Column("territory", sa.String(), nullable=True),
        )

    # 3) INVITATIONS: cria só se não existir
    if not insp.has_table("invitations"):
        op.create_table(
            "invitations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("role", sa.String(), nullable=False),
            sa.Column("token", sa.String(), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("accepted_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_invitations_email", "invitations", ["email"])
        op.create_index("uq_invitations_token", "invitations", ["token"], unique=True)

def downgrade() -> None:
    op.drop_index('uq_invitations_token', table_name='invitations')
    op.drop_index('ix_invitations_email', table_name='invitations')
    op.drop_table('invitations')
    op.drop_table('sailor_profiles')
    with op.batch_alter_table('users') as batch:
        batch.drop_column('email_verified_at')
        batch.drop_column('is_active')

