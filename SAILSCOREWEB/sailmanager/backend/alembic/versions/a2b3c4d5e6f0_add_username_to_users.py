"""add username column to users

Revision ID: a2b3c4d5e6f0
Revises: 499f381ed0c5
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a2b3c4d5e6f0"
down_revision: Union[str, Sequence[str], None] = "499f381ed0c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    user_cols = {c["name"] for c in insp.get_columns("users")}

    # 1) Adiciona coluna username se ainda não existir
    if "username" not in user_cols:
        op.add_column("users", sa.Column("username", sa.String(), nullable=True))

    # 2) Preenche username para utilizadores existentes se estiver vazio
    conn = bind
    rows = conn.execute(sa.text("SELECT id, email, username FROM users")).fetchall()

    existing_usernames = set(
        r.username for r in rows if r.username is not None and str(r.username).strip() != ""
    )

    def make_base_username(email: str | None, user_id: int) -> str:
        if email:
            local = email.split("@", 1)[0]
            base = "".join(ch for ch in local if ch.isalnum()) or f"user{user_id}"
        else:
            base = f"user{user_id}"
        return base

    for row in rows:
        if row.username and str(row.username).strip() != "":
            continue
        base = make_base_username(row.email, row.id)
        candidate = base
        suffix = 1
        while candidate in existing_usernames:
            suffix += 1
            candidate = f"{base}{suffix}"
        conn.execute(
            sa.text("UPDATE users SET username = :u WHERE id = :id"),
            {"u": candidate, "id": row.id},
        )
        existing_usernames.add(candidate)

    # 3) Garante NOT NULL + unique index para username
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("username", existing_type=sa.String(), nullable=False)
        # Cria índice único apenas se ainda não existir um sobre 'username'
        idxs = insp.get_indexes("users")
        username_indexes = {i["name"] for i in idxs if "username" in i.get("column_names", [])}
        if not username_indexes:
            batch_op.create_index("uq_users_username", ["username"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        # Remove índice/unique se existir
        try:
            batch_op.drop_index("uq_users_username")
        except Exception:
            pass
        batch_op.drop_column("username")

