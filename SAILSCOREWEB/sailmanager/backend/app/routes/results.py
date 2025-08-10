# app/routes/results.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from typing import List

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user

router = APIRouter()

class ResultUpsert(BaseModel):
    regatta_id: int
    sail_number: str
    boat_name: str | None = None
    helm_name: str | None = None
    position: int
    points: float

class SingleResultCreate(BaseModel):
  regatta_id: int
  sail_number: str | None = None
  boat_name: str | None = None
  helm_name: str | None = None
  points: float | None = None  # se None, usar position
  desired_position: int

class PositionPatch(BaseModel):
    new_position: int


# ========= CREATE (single) =========
@router.post("/", response_model=schemas.ResultRead, status_code=status.HTTP_201_CREATED)
def create_result(
    result: schemas.ResultCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    regatta = db.query(models.Regatta).filter(models.Regatta.id == result.regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regata não encontrada")

    race = db.query(models.Race).filter(models.Race.id == result.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    new_result = models.Result(
        regatta_id=result.regatta_id,
        race_id=result.race_id,
        sail_number=result.sail_number,
        boat_name=result.boat_name,
        class_name=race.class_name,            # força a classe correta
        skipper_name=result.helm_name,
        position=int(result.position),
        points=float(result.points),
    )
    db.add(new_result)
    db.commit()
    db.refresh(new_result)
    return new_result


# ========= LIST BY REGATTA (optional class) =========
@router.get("/by_regatta/{regatta_id}", response_model=List[schemas.ResultRead])
def get_results_by_regatta(
    regatta_id: int,
    class_name: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Result).filter(models.Result.regatta_id == regatta_id)
    if class_name:
        q = q.filter(models.Result.class_name == class_name)
    return q.order_by(models.Result.position.asc()).all()


# ========= CREATE BULK FOR A RACE (idempotente) =========
@router.post("/races/{race_id}/results", response_model=List[schemas.ResultRead])
def create_results_for_race(
    race_id: int,
    results: List[schemas.ResultCreate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter_by(id=race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    # limpa resultados anteriores da corrida
    db.query(models.Result).filter(models.Result.race_id == race_id).delete()

    created: list[models.Result] = []
    for r in results:
        created_result = models.Result(
            regatta_id=r.regatta_id,
            race_id=race_id,
            sail_number=r.sail_number,
            boat_name=r.boat_name,
            class_name=race.class_name,        # classe vem da corrida
            skipper_name=r.helm_name,
            position=int(r.position),
            points=float(r.points),
        )
        db.add(created_result)
        created.append(created_result)

    db.commit()
    for c in created:
        db.refresh(c)
    return created


# ========= LIST BY RACE =========
@router.get("/races/{race_id}/results", response_model=List[schemas.ResultRead])
def get_results_for_race(race_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc())
        .all()
    )


# ========= DELETE =========
@router.delete("/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_result(
    result_id: int = Path(..., description="ID do resultado a remover"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    result = db.query(models.Result).filter_by(id=result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    db.delete(result)
    db.commit()
    return None


# ========= OVERALL (com filtro de classe) =========
@router.get("/overall/{regatta_id}")
def get_overall_results(
    regatta_id: int,
    class_name: str | None = Query(None),
    db: Session = Depends(get_db),
):
    # 1) corridas relevantes (IDs em ordem)
    race_q = db.query(models.Race).filter(models.Race.regatta_id == regatta_id)
    if class_name:
        race_q = race_q.filter(models.Race.class_name == class_name)
    races = race_q.order_by(models.Race.id.asc()).all()
    race_ids = [r.id for r in races]
    race_map = {r.id: r.name for r in races}

    # 2) agregado por barco (só corridas relevantes)
    agg_q = (
        db.query(
            models.Result.sail_number,
            models.Result.boat_name,
            models.Result.class_name,
            models.Result.skipper_name,
            func.sum(models.Result.points).label("total_points"),
        )
        .filter(models.Result.regatta_id == regatta_id)
    )
    if race_ids:
        agg_q = agg_q.filter(models.Result.race_id.in_(race_ids))
    if class_name:
        agg_q = agg_q.filter(models.Result.class_name == class_name)

    agg_rows = (
        agg_q.group_by(
            models.Result.sail_number,
            models.Result.boat_name,
            models.Result.class_name,
            models.Result.skipper_name,
        )
        .order_by(func.sum(models.Result.points).asc())
        .all()
    )

    # 3) pontos por corrida (indexado por race_id — evita colisão de nomes)
    pr_q = db.query(models.Result).filter(models.Result.regatta_id == regatta_id)
    if race_ids:
        pr_q = pr_q.filter(models.Result.race_id.in_(race_ids))
    if class_name:
        pr_q = pr_q.filter(models.Result.class_name == class_name)

    per_race_map: dict[tuple[str, str, str], dict[int, float]] = {}
    for r in pr_q.all():
        key = (r.class_name, r.sail_number or "", r.skipper_name or "")
        per_race_map.setdefault(key, {})[r.race_id] = float(r.points)

    # 4) resposta ordenada pelos race_ids
    overall = []
    for row in agg_rows:
        key = (row.class_name, row.sail_number or "", row.skipper_name or "")
        per_race_by_id = per_race_map.get(key, {})
        per_race_named = {race_map[rid]: per_race_by_id.get(rid, "-") for rid in race_ids}
        overall.append(
            {
                "sail_number": row.sail_number,
                "boat_name": row.boat_name,
                "class_name": row.class_name,
                "skipper_name": row.skipper_name,
                "total_points": float(row.total_points or 0),
                "per_race": per_race_named,
            }
        )
    return overall


# ========= UPSERT de 1 linha =========


@router.put("/races/{race_id}/result", response_model=schemas.ResultRead)
def upsert_single_result(
    race_id: int,
    payload: ResultUpsert = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    existing = (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id,
                models.Result.sail_number == payload.sail_number)
        .first()
    )

    if existing:
        existing.boat_name    = payload.boat_name
        existing.skipper_name = payload.helm_name
        existing.position     = int(payload.position)
        existing.points       = float(payload.points)
        existing.class_name   = race.class_name  # consistência
        db.commit()
        db.refresh(existing)
        return existing

    new_r = models.Result(
        regatta_id   = payload.regatta_id,
        race_id      = race_id,
        sail_number  = payload.sail_number,
        boat_name    = payload.boat_name,
        skipper_name = payload.helm_name,
        position     = int(payload.position),
        points       = float(payload.points),
        class_name   = race.class_name,
    )
    db.add(new_r)
    db.commit()
    db.refresh(new_r)
    return new_r


# ========= Inserir 1 resultado numa posição com shift =========


@router.post("/races/{race_id}/result", response_model=schemas.ResultRead, status_code=status.HTTP_201_CREATED)
def add_single_result(
    race_id: int,
    payload: SingleResultCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter_by(id=race_id).first()
    if not race:
        raise HTTPException(404, "Corrida não encontrada")

    # Já existe resultado para este barco nesta corrida?
    if payload.sail_number:
        exists = db.query(models.Result).filter(
            and_(models.Result.race_id == race_id,
                 models.Result.sail_number == payload.sail_number)
        ).first()
        if exists:
            raise HTTPException(409, "Este barco já tem resultado nesta corrida")

    # Shift: posições >= desired_position sobem +1
    db.query(models.Result).filter(
        and_(models.Result.race_id == race_id,
             models.Result.position >= payload.desired_position)
    ).update({models.Result.position: models.Result.position + 1}, synchronize_session=False)

    new_res = models.Result(
        regatta_id=payload.regatta_id,
        race_id=race_id,
        sail_number=payload.sail_number,
        boat_name=payload.boat_name,
        class_name=race.class_name,
        skipper_name=payload.helm_name,
        position=payload.desired_position,
        points=float(payload.points if payload.points is not None else payload.desired_position),
    )
    db.add(new_res)
    db.commit()
    db.refresh(new_res)
    return new_res


@router.patch("/{result_id}/position", response_model=schemas.ResultRead)
def change_result_position(
    result_id: int,
    body: PositionPatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter(models.Result.id == result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    if body.new_position < 1:
        raise HTTPException(status_code=400, detail="Posição inválida")

    race_id = row.race_id
    old_pos = int(row.position)
    new_pos = int(body.new_position)

    # limitar ao máximo existente
    max_pos = db.query(func.max(models.Result.position))\
                .filter(models.Result.race_id == race_id).scalar() or 0
    if new_pos > max_pos:
        new_pos = max_pos

    if new_pos == old_pos:
        return row

    if new_pos > old_pos:
        # quem estava (old_pos+1 .. new_pos) desce -1
        db.query(models.Result).filter(
            and_(
                models.Result.race_id == race_id,
                models.Result.position > old_pos,
                models.Result.position <= new_pos,
                models.Result.id != row.id,
            )
        ).update({models.Result.position: models.Result.position - 1},
                 synchronize_session=False)
    else:
        # quem estava (new_pos .. old_pos-1) sobe +1
        db.query(models.Result).filter(
            and_(
                models.Result.race_id == race_id,
                models.Result.position >= new_pos,
                models.Result.position < old_pos,
                models.Result.id != row.id,
            )
        ).update({models.Result.position: models.Result.position + 1},
                 synchronize_session=False)

    row.position = new_pos
    row.points = float(new_pos)  # se pontos=posição
    db.commit()
    db.refresh(row)
    return row


@router.put("/races/{race_id}/reorder", response_model=List[schemas.ResultRead])
def reorder_race_results(
    race_id: int,
    body: ReorderBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    rows = (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc())
        .all()
    )
    id_set = {r.id for r in rows}
    if set(body.ordered_ids) != id_set:
        raise HTTPException(400, "Lista ordered_ids tem de conter exatamente os IDs atuais")

    pos_map = {rid: i + 1 for i, rid in enumerate(body.ordered_ids)}
    for r in rows:
        r.position = pos_map[r.id]
        r.points = float(r.position)  # ajusta se tiveres outra regra de pontos
    db.commit()

    return (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc())
        .all()
    )
