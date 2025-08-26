from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'fd8eb4254add'
down_revision: Union[str, Sequence[str], None] = 'e6babc444ddb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- Defesa: limpar temp tables que possam ter ficado de runs anteriores
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_results;")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_races;")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_entries;")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_notices;")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_regatta_classes;")

    # ---- Backfill para garantir que class_name não tem NULLs antes de NOT NULL
    op.execute("""
        UPDATE races
        SET class_name = 'Open'
        WHERE class_name IS NULL OR trim(class_name) = ''
    """)
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

    # ---- entries
    with op.batch_alter_table('entries', schema=None) as batch_op:
        batch_op.create_foreign_key(
            'fk_entries_regatta_id_regattas',
            'regattas', ['regatta_id'], ['id'],
            ondelete='CASCADE'
        )

    # ---- notices
    with op.batch_alter_table('notices', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_notices_regatta_id'), ['regatta_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_notices_regatta_id_regattas',
            'regattas', ['regatta_id'], ['id'],
            ondelete='CASCADE'
        )

    # ---- races (FASE 1) — adicionar coluna (NULL), definir NOT NULL só depois do backfill
    with op.batch_alter_table('races', schema=None) as batch_op:
        batch_op.add_column(sa.Column('order_index', sa.Integer(), nullable=True))
        batch_op.alter_column('class_name', existing_type=sa.VARCHAR(), nullable=False)

    # Backfill de order_index por (regatta_id, class_name) usando ROW_NUMBER
    # (SQLite moderno suporta window functions)
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

    # ---- races (FASE 2) — agora sim, NOT NULL, índices e UNIQUE
    with op.batch_alter_table('races', schema=None) as batch_op:
        batch_op.alter_column('order_index', existing_type=sa.Integer(), nullable=False)
        batch_op.create_index(batch_op.f('ix_races_class_name'), ['class_name'], unique=False)
        batch_op.create_index(batch_op.f('ix_races_order_index'), ['order_index'], unique=False)
        batch_op.create_index('ix_races_regatta_class', ['regatta_id', 'class_name'], unique=False)
        batch_op.create_index(batch_op.f('ix_races_regatta_id'), ['regatta_id'], unique=False)
        batch_op.create_index('ix_races_regatta_order', ['regatta_id', 'order_index'], unique=False)
        batch_op.create_unique_constraint(
            'uq_race_regatta_class_order',
            ['regatta_id', 'class_name', 'order_index']
        )
        batch_op.create_foreign_key(
            'fk_races_regatta_id_regattas',
            'regattas', ['regatta_id'], ['id'],
            ondelete='CASCADE'
        )

    # ---- regatta_classes
    with op.batch_alter_table('regatta_classes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_regatta_classes_class_name'), ['class_name'], unique=False)
        batch_op.create_index(batch_op.f('ix_regatta_classes_regatta_id'), ['regatta_id'], unique=False)
        batch_op.create_unique_constraint('uq_regatta_class', ['regatta_id', 'class_name'])
        batch_op.create_foreign_key(
            'fk_regatta_classes_regatta_id_regattas',
            'regattas', ['regatta_id'], ['id'],
            ondelete='CASCADE'
        )

    # ---- regattas
    with op.batch_alter_table('regattas', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_regattas_name'), ['name'], unique=False)

    # ---- results
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_results;")
    with op.batch_alter_table('results', schema=None) as batch_op:
        batch_op.alter_column('class_name', existing_type=sa.VARCHAR(), nullable=False)
        batch_op.drop_index('uq_results_race_sail')  # era índice único
        batch_op.create_index(batch_op.f('ix_results_class_name'), ['class_name'], unique=False)
        batch_op.create_index(batch_op.f('ix_results_race_id'), ['race_id'], unique=False)
        batch_op.create_index('ix_results_regatta_class', ['regatta_id', 'class_name'], unique=False)
        batch_op.create_index(batch_op.f('ix_results_regatta_id'), ['regatta_id'], unique=False)
        batch_op.create_index('ix_results_regatta_race_position', ['regatta_id', 'race_id', 'position'], unique=False)
        batch_op.create_index(batch_op.f('ix_results_sail_number'), ['sail_number'], unique=False)
        batch_op.create_foreign_key(
            'fk_results_regatta_id_regattas',
            'regattas', ['regatta_id'], ['id'],
            ondelete='CASCADE'
        )
        batch_op.create_foreign_key(
            'fk_results_race_id_races',
            'races', ['race_id'], ['id'],
            ondelete='CASCADE'
        )
        batch_op.drop_column('boat_class')
        batch_op.drop_column('helm_name')


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_results;")
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_races;")

    with op.batch_alter_table('results', schema=None) as batch_op:
        batch_op.add_column(sa.Column('helm_name', sa.VARCHAR(), nullable=True))
        batch_op.add_column(sa.Column('boat_class', sa.VARCHAR(), nullable=True))
        batch_op.drop_index(batch_op.f('ix_results_sail_number'))
        batch_op.drop_index('ix_results_regatta_race_position')
        batch_op.drop_index(batch_op.f('ix_results_regatta_id'))
        batch_op.drop_index('ix_results_regatta_class')
        batch_op.drop_index(batch_op.f('ix_results_race_id'))
        batch_op.drop_index(batch_op.f('ix_results_class_name'))
        batch_op.create_index('uq_results_race_sail', ['race_id', 'sail_number'], unique=True)
        batch_op.alter_column('class_name', existing_type=sa.VARCHAR(), nullable=True)

    with op.batch_alter_table('regattas', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_regattas_name'))

    with op.batch_alter_table('regatta_classes', schema=None) as batch_op:
        batch_op.drop_constraint('uq_regatta_class', type_='unique')
        batch_op.drop_index(batch_op.f('ix_regatta_classes_regatta_id'))
        batch_op.drop_index(batch_op.f('ix_regatta_classes_class_name'))

    # races: reverter UNIQUE/índices e tornar order_index NULL de novo
    with op.batch_alter_table('races', schema=None) as batch_op:
        batch_op.drop_constraint('uq_race_regatta_class_order', type_='unique')
        batch_op.drop_index('ix_races_regatta_order')
        batch_op.drop_index(batch_op.f('ix_races_regatta_id'))
        batch_op.drop_index('ix_races_regatta_class')
        batch_op.drop_index(batch_op.f('ix_races_order_index'))
        batch_op.drop_index(batch_op.f('ix_races_class_name'))
        batch_op.alter_column('order_index', existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column('class_name', existing_type=sa.VARCHAR(), nullable=True)
        batch_op.drop_column('order_index')

    with op.batch_alter_table('notices', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_notices_regatta_id'))
