from fastapi import APIRouter, Depends, HTTPException, Body, Path, status
from sqlalchemy.orm import Session
from sqlalchemy import func
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

# Versão curta (o frontend está a usar esta): /races/regattas/{id}/reorder
@router.put("/regattas/{regatta_id}/reorder", response_model=List[schemas.RaceRead])
def reorder_races_short(
    regatta_id: int,
    body: schemas.RacesReorder = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return _reorder_impl(regatta_id, body, db, current_user)

# Alias legacy para chamadas antigas: /races/regattas/{id}/races/reorder
@router.put("/regattas/{regatta_id}/races/reorder", response_model=List[schemas.RaceRead])
def reorder_races_legacy(
    regatta_id: int,
    body: schemas.RacesReorder = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return _reorder_impl(regatta_id, body, db, current_user)

def _reorder_impl(
    regatta_id: int,
    body: schemas.RacesReorder,
    db: Session,
    current_user: models.User,
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    rows = db.query(models.Race).filter(models.Race.regatta_id == regatta_id).all()
    current_ids = {r.id for r in rows}
    ordered = list(body.ordered_ids or [])

    # validação: tem de conter exatamente os IDs existentes
    if set(ordered) != current_ids:
        raise HTTPException(status_code=400, detail="ordered_ids tem de conter exatamente todos os IDs da regata.")

    # ordena as corridas pelos IDs na lista e reatribui order_index por classe (0-based)
    order_pos = {rid: i for i, rid in enumerate(ordered)}
    by_class = {}
    for r in rows:
        by_class.setdefault(r.class_name, []).append(r)

    for cls, lst in by_class.items():
        lst.sort(key=lambda r: order_pos[r.id])
        for i, r in enumerate(lst):
            r.order_index = i  # 0-based, consistente com a migration

    db.commit()

    # retorna a lista ordenada
    return (
        db.query(models.Race)
        .filter_by(regatta_id=regatta_id)
        .order_by(models.Race.order_index.asc(), models.Race.id.asc())
        .all()
    )
