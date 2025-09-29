"""PTL: add time_limit_hm and backfill from minutes

Revision ID: c42d8c56a27a
Revises: 232ff7f84820
Create Date: 2025-09-29 22:50:54.144066
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c42d8c56a27a"
down_revision: Union[str, Sequence[str], None] = "232ff7f84820"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _minutes_to_hhmm(minutes: int | None) -> str | None:
    if minutes is None:
        return None
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    colnames = {c["name"] for c in insp.get_columns("protest_time_limits")}

    # 1) Adiciona a coluna nova como nullable (permite backfill primeiro)
    with op.batch_alter_table("protest_time_limits", recreate="auto") as batch:
        batch.add_column(sa.Column("time_limit_hm", sa.String(length=5), nullable=True))

    # 2) Backfill a partir de time_limit_minutes, se existir
    if "time_limit_minutes" in colnames:
        rows = bind.execute(
            sa.text("SELECT id, time_limit_minutes FROM protest_time_limits")
        ).fetchall()
        for row in rows:
            # row pode ser tuple-like (id, minutes) dependendo do driver
            rid = row[0]
            minutes = row[1]
            tl = _minutes_to_hhmm(minutes)
            if tl is not None:
                bind.execute(
                    sa.text(
                        "UPDATE protest_time_limits SET time_limit_hm = :tl WHERE id = :id"
                    ),
                    {"tl": tl, "id": rid},
                )

    # 3) Torna NOT NULL depois do backfill
    with op.batch_alter_table("protest_time_limits", recreate="auto") as batch:
        batch.alter_column(
            "time_limit_hm",
            existing_type=sa.String(length=5),
            nullable=False,
        )

    # 4) (Opcional) Remover colunas antigas se existirem
    #    Nota: fazê-lo em blocos separados evita erros quando a coluna não existe.
    if "time_limit_minutes" in colnames:
        with op.batch_alter_table("protest_time_limits", recreate="auto") as batch:
            batch.drop_column("time_limit_minutes")

    if "posting_time" in colnames:
        with op.batch_alter_table("protest_time_limits", recreate="auto") as batch:
            batch.drop_column("posting_time")


def _hhmm_to_minutes(hhmm: str | None) -> int | None:
    if not hhmm:
        return None
    try:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return None


def downgrade() -> None:
    bind = op.get_bind()

    # 1) Recria a coluna antiga minutes (nullable) para receber backfill
    with op.batch_alter_table("protest_time_limits", recreate="auto") as batch:
        batch.add_column(sa.Column("time_limit_minutes", sa.Integer(), nullable=True))

    # 2) Backfill de HH:MM -> minutes
    rows = bind.execute(
        sa.text("SELECT id, time_limit_hm FROM protest_time_limits")
    ).fetchall()
    for row in rows:
        rid = row[0]
        hhmm = row[1]
        minutes = _hhmm_to_minutes(hhmm)
        if minutes is not None:
            bind.execute(
                sa.text(
                    "UPDATE protest_time_limits SET time_limit_minutes = :m WHERE id = :id"
                ),
                {"m": minutes, "id": rid},
            )

    # 3) Remove a coluna nova
    with op.batch_alter_table("protest_time_limits", recreate="auto") as batch:
        batch.drop_column("time_limit_hm")

    # (Opcional) Recriar posting_time se quiseres uma reversão perfeita:
    # with op.batch_alter_table("protest_time_limits", recreate="auto") as batch:
    #     batch.add_column(sa.Column("posting_time", sa.String(length=8), nullable=True))
