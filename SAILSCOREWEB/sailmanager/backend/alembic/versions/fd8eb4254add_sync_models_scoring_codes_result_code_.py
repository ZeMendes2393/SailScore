from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'fd8eb4254add'
down_revision: Union[str, Sequence[str], None] = 'e6babc444ddb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(bind, table: str) -> set[str]:
    insp = sa.inspect(bind)
    if table not in insp.get_table_names():
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def _has_index(bind, table: str, name: str) -> bool:
    insp = sa.inspect(bind)
    try:
        return name in {i["name"] for i in insp.get_indexes(table)}
    except Exception:
        return False


def _has_fk(bind, table: str, name: str) -> bool:
    insp = sa.inspect(bind)
    try:
        return name in {
            fk.get("name")
            for fk in insp.get_foreign_keys(table)
            if fk.get("name")
        }
    except Exception:
        return False


def _has_unique_constraint(bind, table: str, name: str) -> bool:
    insp = sa.inspect(bind)
    try:
        return name in {
            uc.get("name")
            for uc in insp.get_unique_constraints(table)
            if uc.get("name")
        }
    except Exception:
        return False


def _ensure_results_class_name(bind) -> set[str]:
    """Garante coluna results.class_name (copia de boat_class se existir)."""
    cols = _cols(bind, "results")
    if "results" not in sa.inspect(bind).get_table_names():
        return cols
    if "class_name" not in cols:
        op.add_column("results", sa.Column("class_name", sa.String(), nullable=True))
        cols = _cols(bind, "results")
        if "boat_class" in cols:
            op.execute("UPDATE results SET class_name = boat_class WHERE class_name IS NULL")
    return _cols(bind, "results")


def _skip_fd8eb4254add(bind) -> bool:
    """BD de produção já tem o efeito desta migration (criada fora do Alembic)."""
    tables = set(sa.inspect(bind).get_table_names())
    if "regatta_classes" in tables and _has_unique_constraint(bind, "regatta_classes", "uq_regatta_class"):
        return True
    race_cols = _cols(bind, "races")
    if "races" in tables and "order_index" in race_cols:
        if _has_unique_constraint(bind, "races", "uq_race_regatta_class_order"):
            return True
        if _has_index(bind, "races", "ix_races_regatta_order"):
            return True
    if "races" not in tables or "results" not in tables:
        return False
    result_cols = _cols(bind, "results")
    if "order_index" not in race_cols or "class_name" not in result_cols:
        return False
    if "boat_class" in result_cols or "helm_name" in result_cols:
        return False
    return True


def upgrade() -> None:
    bind = op.get_bind()

    if _skip_fd8eb4254add(bind):
        return

    op.execute("DROP TABLE IF EXISTS _alembic_tmp_results;")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_races;")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_entries;")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_notices;")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_regatta_classes;")

    race_cols = _cols(bind, "races")
    if "class_name" in race_cols:
        op.execute("""
            UPDATE races
            SET class_name = 'Open'
            WHERE class_name IS NULL OR trim(class_name) = ''
        """)

    result_cols = _ensure_results_class_name(bind)
    race_cols = _cols(bind, "races")
    if "class_name" in result_cols and "race_id" in result_cols and "class_name" in race_cols:
        op.execute("""
            UPDATE results
            SET class_name = (
                SELECT r.class_name
                FROM races r
                WHERE r.id = results.race_id
            )
            WHERE class_name IS NULL OR trim(class_name) = ''
        """)
        op.execute("""
            UPDATE results
            SET class_name = 'Open'
            WHERE class_name IS NULL OR trim(class_name) = ''
        """)

    if "entries" in sa.inspect(bind).get_table_names():
        if not _has_fk(bind, "entries", "fk_entries_regatta_id_regattas"):
            with op.batch_alter_table('entries', schema=None) as batch_op:
                batch_op.create_foreign_key(
                    'fk_entries_regatta_id_regattas',
                    'regattas', ['regatta_id'], ['id'],
                    ondelete='CASCADE',
                )

    if "notices" in sa.inspect(bind).get_table_names():
        with op.batch_alter_table('notices', schema=None) as batch_op:
            if not _has_index(bind, "notices", "ix_notices_regatta_id"):
                batch_op.create_index(batch_op.f('ix_notices_regatta_id'), ['regatta_id'], unique=False)
            if not _has_fk(bind, "notices", "fk_notices_regatta_id_regattas"):
                batch_op.create_foreign_key(
                    'fk_notices_regatta_id_regattas',
                    'regattas', ['regatta_id'], ['id'],
                    ondelete='CASCADE',
                )

    race_cols = _cols(bind, "races")
    if (
        "races" in sa.inspect(bind).get_table_names()
        and "order_index" not in race_cols
        and "class_name" in race_cols
    ):
        with op.batch_alter_table('races', schema=None) as batch_op:
            batch_op.add_column(sa.Column('order_index', sa.Integer(), nullable=True))
            batch_op.alter_column('class_name', existing_type=sa.VARCHAR(), nullable=False)

        op.execute("""
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY regatta_id, class_name
                        ORDER BY date, id
                    ) AS rn
                FROM races
            )
            UPDATE races
            SET order_index = (SELECT rn - 1 FROM ranked WHERE ranked.id = races.id)
            WHERE order_index IS NULL;
        """)

        with op.batch_alter_table('races', schema=None) as batch_op:
            batch_op.alter_column('order_index', existing_type=sa.Integer(), nullable=False)
            if not _has_index(bind, "races", "ix_races_class_name"):
                batch_op.create_index(batch_op.f('ix_races_class_name'), ['class_name'], unique=False)
            if not _has_index(bind, "races", "ix_races_order_index"):
                batch_op.create_index(batch_op.f('ix_races_order_index'), ['order_index'], unique=False)
            if not _has_index(bind, "races", "ix_races_regatta_class"):
                batch_op.create_index('ix_races_regatta_class', ['regatta_id', 'class_name'], unique=False)
            if not _has_index(bind, "races", "ix_races_regatta_id"):
                batch_op.create_index(batch_op.f('ix_races_regatta_id'), ['regatta_id'], unique=False)
            if not _has_index(bind, "races", "ix_races_regatta_order"):
                batch_op.create_index('ix_races_regatta_order', ['regatta_id', 'order_index'], unique=False)
            if not _has_fk(bind, "races", "fk_races_regatta_id_regattas"):
                batch_op.create_foreign_key(
                    'fk_races_regatta_id_regattas',
                    'regattas', ['regatta_id'], ['id'],
                    ondelete='CASCADE',
                )

        if not _has_unique_constraint(bind, "races", "uq_race_regatta_class_order"):
            op.create_unique_constraint(
                "uq_race_regatta_class_order",
                "races",
                ["regatta_id", "class_name", "order_index"],
            )

    if "regatta_classes" in sa.inspect(bind).get_table_names():
        with op.batch_alter_table('regatta_classes', schema=None) as batch_op:
            if not _has_index(bind, "regatta_classes", "ix_regatta_classes_class_name"):
                batch_op.create_index(batch_op.f('ix_regatta_classes_class_name'), ['class_name'], unique=False)
            if not _has_index(bind, "regatta_classes", "ix_regatta_classes_regatta_id"):
                batch_op.create_index(batch_op.f('ix_regatta_classes_regatta_id'), ['regatta_id'], unique=False)
            if not _has_fk(bind, "regatta_classes", "fk_regatta_classes_regatta_id_regattas"):
                batch_op.create_foreign_key(
                    'fk_regatta_classes_regatta_id_regattas',
                    'regattas', ['regatta_id'], ['id'],
                    ondelete='CASCADE',
                )
        if not _has_unique_constraint(bind, "regatta_classes", "uq_regatta_class"):
            op.create_unique_constraint(
                "uq_regatta_class",
                "regatta_classes",
                ["regatta_id", "class_name"],
            )

    if "regattas" in sa.inspect(bind).get_table_names():
        if not _has_index(bind, "regattas", "ix_regattas_name"):
            with op.batch_alter_table('regattas', schema=None) as batch_op:
                batch_op.create_index(batch_op.f('ix_regattas_name'), ['name'], unique=False)

    result_cols = _cols(bind, "results")
    if "results" not in sa.inspect(bind).get_table_names() or "class_name" not in result_cols:
        return

    # Já no estado final (sem boat_class/helm_name legados)
    if "boat_class" not in result_cols and "helm_name" not in result_cols:
        if _has_index(bind, "results", "ix_results_class_name"):
            return

    op.execute("DROP TABLE IF EXISTS _alembic_tmp_results;")
    with op.batch_alter_table('results', schema=None) as batch_op:
        batch_op.alter_column('class_name', existing_type=sa.VARCHAR(), nullable=False)
        if _has_index(bind, "results", "uq_results_race_sail"):
            batch_op.drop_index('uq_results_race_sail')
        if not _has_index(bind, "results", "ix_results_class_name"):
            batch_op.create_index(batch_op.f('ix_results_class_name'), ['class_name'], unique=False)
        if not _has_index(bind, "results", "ix_results_race_id"):
            batch_op.create_index(batch_op.f('ix_results_race_id'), ['race_id'], unique=False)
        if not _has_index(bind, "results", "ix_results_regatta_class"):
            batch_op.create_index('ix_results_regatta_class', ['regatta_id', 'class_name'], unique=False)
        if not _has_index(bind, "results", "ix_results_regatta_id"):
            batch_op.create_index(batch_op.f('ix_results_regatta_id'), ['regatta_id'], unique=False)
        if not _has_index(bind, "results", "ix_results_regatta_race_position"):
            batch_op.create_index(
                'ix_results_regatta_race_position',
                ['regatta_id', 'race_id', 'position'],
                unique=False,
            )
        if not _has_index(bind, "results", "ix_results_sail_number"):
            batch_op.create_index(batch_op.f('ix_results_sail_number'), ['sail_number'], unique=False)
        if not _has_fk(bind, "results", "fk_results_regatta_id_regattas"):
            batch_op.create_foreign_key(
                'fk_results_regatta_id_regattas',
                'regattas', ['regatta_id'], ['id'],
                ondelete='CASCADE',
            )
        if not _has_fk(bind, "results", "fk_results_race_id_races"):
            batch_op.create_foreign_key(
                'fk_results_race_id_races',
                'races', ['race_id'], ['id'],
                ondelete='CASCADE',
            )
        result_cols = _cols(bind, "results")
        if "boat_class" in result_cols:
            batch_op.drop_column('boat_class')
        if "helm_name" in result_cols:
            batch_op.drop_column('helm_name')


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_results;")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_races;")

    bind = op.get_bind()
    result_cols = _cols(bind, "results")
    if "results" in sa.inspect(bind).get_table_names() and "class_name" in result_cols:
        with op.batch_alter_table('results', schema=None) as batch_op:
            if "boat_class" not in result_cols:
                batch_op.add_column(sa.Column('helm_name', sa.VARCHAR(), nullable=True))
                batch_op.add_column(sa.Column('boat_class', sa.VARCHAR(), nullable=True))
            if _has_index(bind, "results", "ix_results_sail_number"):
                batch_op.drop_index(batch_op.f('ix_results_sail_number'))
            if _has_index(bind, "results", "ix_results_regatta_race_position"):
                batch_op.drop_index('ix_results_regatta_race_position')
            if _has_index(bind, "results", "ix_results_regatta_id"):
                batch_op.drop_index(batch_op.f('ix_results_regatta_id'))
            if _has_index(bind, "results", "ix_results_regatta_class"):
                batch_op.drop_index('ix_results_regatta_class')
            if _has_index(bind, "results", "ix_results_race_id"):
                batch_op.drop_index(batch_op.f('ix_results_race_id'))
            if _has_index(bind, "results", "ix_results_class_name"):
                batch_op.drop_index(batch_op.f('ix_results_class_name'))
            if not _has_index(bind, "results", "uq_results_race_sail"):
                batch_op.create_index('uq_results_race_sail', ['race_id', 'sail_number'], unique=True)
            batch_op.alter_column('class_name', existing_type=sa.VARCHAR(), nullable=True)

    if "regattas" in sa.inspect(bind).get_table_names() and _has_index(bind, "regattas", "ix_regattas_name"):
        with op.batch_alter_table('regattas', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_regattas_name'))

    if "regatta_classes" in sa.inspect(bind).get_table_names():
        with op.batch_alter_table('regatta_classes', schema=None) as batch_op:
            try:
                batch_op.drop_constraint('uq_regatta_class', type_='unique')
            except Exception:
                pass
            if _has_index(bind, "regatta_classes", "ix_regatta_classes_regatta_id"):
                batch_op.drop_index(batch_op.f('ix_regatta_classes_regatta_id'))
            if _has_index(bind, "regatta_classes", "ix_regatta_classes_class_name"):
                batch_op.drop_index(batch_op.f('ix_regatta_classes_class_name'))

    if "races" in sa.inspect(bind).get_table_names() and "order_index" in _cols(bind, "races"):
        with op.batch_alter_table('races', schema=None) as batch_op:
            try:
                batch_op.drop_constraint('uq_race_regatta_class_order', type_='unique')
            except Exception:
                pass
            if _has_index(bind, "races", "ix_races_regatta_order"):
                batch_op.drop_index('ix_races_regatta_order')
            if _has_index(bind, "races", "ix_races_regatta_id"):
                batch_op.drop_index(batch_op.f('ix_races_regatta_id'))
            if _has_index(bind, "races", "ix_races_regatta_class"):
                batch_op.drop_index('ix_races_regatta_class')
            if _has_index(bind, "races", "ix_races_order_index"):
                batch_op.drop_index(batch_op.f('ix_races_order_index'))
            if _has_index(bind, "races", "ix_races_class_name"):
                batch_op.drop_index(batch_op.f('ix_races_class_name'))
            batch_op.alter_column('order_index', existing_type=sa.Integer(), nullable=True)
            if "class_name" in _cols(bind, "races"):
                batch_op.alter_column('class_name', existing_type=sa.VARCHAR(), nullable=True)
            batch_op.drop_column('order_index')

    if "notices" in sa.inspect(bind).get_table_names() and _has_index(bind, "notices", "ix_notices_regatta_id"):
        with op.batch_alter_table('notices', schema=None) as batch_op:
            batch_op.drop_index(batch_op.f('ix_notices_regatta_id'))
