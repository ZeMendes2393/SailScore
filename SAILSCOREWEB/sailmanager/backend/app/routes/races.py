from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import func, text, bindparam
from typing import List
from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user

router = APIRouter()

def _stored_name(base_name: str, class_tag: str) -> str:
    base_name = (base_name or "").strip()
    class_tag = (class_tag or "").strip()
    return base_name if (class_tag and class_tag in base_name) else f"{base_name} ({class_tag})"

@router.post("",  response_model=schemas.RaceRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=schemas.RaceRead, status_code=status.HTTP_201_CREATED)
def create_race(
    race: schemas.RaceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")

    if not (race.name or "").strip():
        raise HTTPException(status_code=400, detail="Race name is required")
    if not (race.class_name or "").strip():
        raise HTTPException(status_code=400, detail="class_name is required")

    stored_name = _stored_name(race.name, race.class_name)

    exists = db.query(models.Race).filter(
        models.Race.regatta_id == race.regatta_id,
        models.Race.name == stored_name,
        models.Race.class_name == race.class_name,
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Já existe uma corrida com esse nome nessa classe.")

    # order_index no fim da lista da regata (0-based para bater com a migration)
    max_order = db.query(func.max(models.Race.order_index))\
                  .filter(models.Race.regatta_id == race.regatta_id)\
                  .scalar()
    max_order = int(max_order) if max_order is not None else -1
    new_order = race.order_index if race.order_index is not None else (max_order + 1)

    new_race = models.Race(
        regatta_id=race.regatta_id,
        name=stored_name,
        date=race.date,
        class_name=race.class_name,
        order_index=int(new_order),
    )
    db.add(new_race)
    db.commit()
    db.refresh(new_race)
    return new_race

@router.get("/by_regatta/{regatta_id}", response_model=List[schemas.RaceRead])
def get_races_by_regatta(regatta_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Race)
        .filter_by(regatta_id=regatta_id)
        .order_by(models.Race.order_index.asc(), models.Race.id.asc())
        .all()
    )

@router.patch("/{race_id}", response_model=schemas.RaceRead)
def update_race(
    race_id: int,
    body: schemas.RaceUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    r = db.query(models.Race).filter_by(id=race_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    if body.name is not None:
        new_name = _stored_name(body.name, r.class_name)
        dup = db.query(models.Race).filter(
            models.Race.regatta_id == r.regatta_id,
            models.Race.class_name == r.class_name,
            models.Race.name == new_name,
            models.Race.id != r.id,
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail="Já existe corrida com esse nome nessa classe.")
        r.name = new_name

    if body.date is not None:
        r.date = body.date

    if body.order_index is not None:
        r.order_index = int(body.order_index)

    db.commit()
    db.refresh(r)
    return r

@router.delete("/{race_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_race(
    race_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    r = db.query(models.Race).filter_by(id=race_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    db.delete(r)  # results caem por cascade
    db.commit()
    return None

# ====== REORDER ======
# Continua a aceitar o schema atual: { "ordered_ids": [ ... ] }
# app/routes/races.py (apenas a função de reorder)


@router.put("/regattas/{regatta_id}/reorder", response_model=List[schemas.RaceRead])
def reorder_races_short(
    regatta_id: int,
    body: schemas.RacesReorder = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return _reorder_impl_atomic(regatta_id, body, db, current_user)

@router.put("/regattas/{regatta_id}/races/reorder", response_model=List[schemas.RaceRead])
def reorder_races_legacy(
    regatta_id: int,
    body: schemas.RacesReorder = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return _reorder_impl_atomic(regatta_id, body, db, current_user)


def _reorder_impl_atomic(regatta_id: int, body, db, current_user):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Aceitamos { ordered_ids: [...] } opcional/parcelar
    ordered = list(getattr(body, "ordered_ids", []) or [])
    if not ordered:
        raise HTTPException(status_code=400, detail="Lista de ids vazia.")

    # 1) Validar que os IDs enviados pertencem à mesma regata e obter a classe
    sel_sent = (
        text("""
            SELECT id, class_name
            FROM races
            WHERE regatta_id = :rid AND id IN :ids
        """).bindparams(bindparam("ids", expanding=True))
    )
    sent_rows = db.execute(sel_sent, {"rid": regatta_id, "ids": ordered}).fetchall()
    if len(sent_rows) != len(ordered):
        raise HTTPException(status_code=400, detail="IDs inválidos para esta regata.")

    classes = {r.class_name for r in sent_rows}
    if len(classes) != 1:
        raise HTTPException(status_code=400, detail="O reorder deve ser feito apenas dentro de uma classe.")
    class_name = next(iter(classes))

    # 2) Obter **todas** as corridas dessa classe na regata, na ordem atual
    all_rows = db.execute(
        text("""
            SELECT id, order_index
            FROM races
            WHERE regatta_id = :rid AND class_name = :cname
            ORDER BY order_index ASC, id ASC
        """),
        {"rid": regatta_id, "cname": class_name}
    ).fetchall()
    all_ids = [r.id for r in all_rows]

    # 3) Construir a nova ordem:
    #    - primeiro os IDs pedidos (mantendo a ordem dada),
    #    - depois o resto, mantendo ordem relativa atual.
    ordered_set = set(ordered)
    rest_ids = [rid for rid in all_ids if rid not in ordered_set]
    final_order = ordered + rest_ids  # 0..N-1 (completo para a classe)

    # 4) Fase A: levantar todos os índices desta classe para evitar colisões UNIQUE
    BUMP = 100000
    db.execute(
        text("""
            UPDATE races
            SET order_index = order_index + :bump
            WHERE regatta_id = :rid AND class_name = :cname
        """),
        {"bump": BUMP, "rid": regatta_id, "cname": class_name}
    )
    db.flush()

    # 5) Fase B: aplicar os novos índices com CASE numa única query
    when_sql = " ".join(f"WHEN {rid} THEN {idx}" for idx, rid in enumerate(final_order))
    upd = text(f"""
        UPDATE races
        SET order_index = CASE id
          {when_sql}
        END
        WHERE regatta_id = :rid AND class_name = :cname
    """)
    db.execute(upd, {"rid": regatta_id, "cname": class_name})
    db.commit()

    # 6) Devolver a lista completa da regata, já ordenada
    return (
        db.query(models.Race)
        .filter_by(regatta_id=regatta_id)
        .order_by(models.Race.order_index.asc(), models.Race.id.asc())
        .all()
    )

@router.post("/regattas/{regatta_id}/medal_race", response_model=RaceRead)
def create_medal_race(regatta_id: int, db: Session = Depends(get_db)):
    name = "Medal Race"

    race = Race(
        regatta_id=regatta_id,
        name=name,
        class_name="Medal",      # opcional, dependendo do teu modelo
        is_medal_race=True,
        double_points=True,
        discardable=False
    )
    db.add(race)
    db.commit()
    db.refresh(race)

    return race

