from alembic import op
import sqlalchemy as sa
from typing import Sequence, Union

# Revision identifiers
revision: str = '7cf224e70fed'
down_revision: Union[str, Sequence[str], None] = '20251031_regatta_class_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 🔧 SQLite safety: se existirem tabelas antigas (por falha anterior), remove-as primeiro
    op.execute("DROP TABLE IF EXISTS fleet_assignments")
    op.execute("DROP TABLE IF EXISTS fleets")
    op.execute("DROP TABLE IF EXISTS fleet_sets")

    # ---------- TABELA: fleet_sets ----------
    op.create_table(
        "fleet_sets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "regatta_id",
            sa.Integer,
            sa.ForeignKey("regattas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("class_name", sa.String(255), nullable=False),
        sa.Column("phase", sa.String(32), nullable=False),  # 'qualifying' | 'finals'
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "regatta_id", "class_name", "phase", "label",
            name="uq_fleet_sets_regatta_class_phase_label"
        ),
    )

    # ---------- TABELA: fleets ----------
    op.create_table(
        "fleets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "fleet_set_id",
            sa.Integer,
            sa.ForeignKey("fleet_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("order_index", sa.Integer, nullable=True),
        sa.UniqueConstraint("fleet_set_id", "name", name="uq_fleets_set_name"),
    )

    # ---------- TABELA: fleet_assignments ----------
    op.create_table(
        "fleet_assignments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "fleet_set_id",
            sa.Integer,
            sa.ForeignKey("fleet_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "fleet_id",
            sa.Integer,
            sa.ForeignKey("fleets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "entry_id",
            sa.Integer,
            sa.ForeignKey("entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("fleet_set_id", "entry_id", name="uq_assignments_set_entry"),
    )

    # ---------- ALTERAÇÃO: tabela races ----------
    with op.batch_alter_table("races") as batch:
        # adiciona colunas
        batch.add_column(sa.Column("fleet_set_id", sa.Integer, nullable=True))
        batch.add_column(sa.Column("fleet_id", sa.Integer, nullable=True))

        # foreign keys com nomes explícitos (obrigatório em SQLite)
        batch.create_foreign_key(
            "fk_races_fleet_set_id",
            "fleet_sets",
            ["fleet_set_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_foreign_key(
            "fk_races_fleet_id",
            "fleets",
            ["fleet_id"],
            ["id"],
            ondelete="SET NULL",
        )

        # índices auxiliares
        batch.create_index("ix_races_regatta_set", ["regatta_id", "fleet_set_id"])
        batch.create_index("ix_races_regatta_fleet", ["regatta_id", "fleet_id"])


def downgrade() -> None:
    # ---------- Reverter alterações em races ----------
    with op.batch_alter_table("races") as batch:
        batch.drop_index("ix_races_regatta_fleet")
        batch.drop_index("ix_races_regatta_set")
        batch.drop_constraint("fk_races_fleet_id", type_="foreignkey")
        batch.drop_constraint("fk_races_fleet_set_id", type_="foreignkey")
        batch.drop_column("fleet_id")
        batch.drop_column("fleet_set_id")

    # ---------- Remover as novas tabelas ----------
    op.drop_table("fleet_assignments")
    op.drop_table("fleets")
    op.drop_table("fleet_sets")
