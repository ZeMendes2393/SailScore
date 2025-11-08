"""add fleet_set_id to races

Revision ID: b78df6eeb67d
Revises: 7cf224e70fed
Create Date: 2025-11-07 14:53:28.230297
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b78df6eeb67d"
down_revision: Union[str, Sequence[str], None] = "7cf224e70fed"
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # Estado atual
    cols = {c["name"] for c in insp.get_columns("races")}
    idx_names = {ix["name"] for ix in insp.get_indexes("races")}
    fk_list = insp.get_foreign_keys("races")
    has_fk = any(
        set(fk.get("constrained_columns", [])) == {"fleet_set_id"}
        and fk.get("referred_table") == "fleet_sets"
        for fk in fk_list
    )

    # Usar batch para suportar SQLite (recria a tabela se necessário)
    with op.batch_alter_table("races", recreate="auto") as batch_op:
        if "fleet_set_id" not in cols:
            batch_op.add_column(sa.Column("fleet_set_id", sa.Integer(), nullable=True))

        if "ix_races_fleet_set_id" not in idx_names:
            batch_op.create_index("ix_races_fleet_set_id", ["fleet_set_id"])

        if not has_fk:
            batch_op.create_foreign_key(
                "fk_races_fleet_set_id_fleet_sets",
                "fleet_sets",
                ["fleet_set_id"],
                ["id"],
                ondelete="SET NULL",
            )

def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    cols = {c["name"] for c in insp.get_columns("races")}
    idx_names = {ix["name"] for ix in insp.get_indexes("races")}
    fk_list = insp.get_foreign_keys("races")
    has_fk = any(
        set(fk.get("constrained_columns", [])) == {"fleet_set_id"}
        and fk.get("referred_table") == "fleet_sets"
        for fk in fk_list
    )

    with op.batch_alter_table("races", recreate="auto") as batch_op:
        if has_fk:
            batch_op.drop_constraint(
                "fk_races_fleet_set_id_fleet_sets", type_="foreignkey"
            )
        if "ix_races_fleet_set_id" in idx_names:
            batch_op.drop_index("ix_races_fleet_set_id")
        if "fleet_set_id" in cols:
            batch_op.drop_column("fleet_set_id")
