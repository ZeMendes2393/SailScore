# app/routes/results_race.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user

from app.routes.results_utils import (
    ResultUpsert,
    SingleResultCreate,
    ReorderBody,
    _norm,
    _norm_sn,
    removes_from_ranking,
    get_scoring_map,
    compute_points_for_code,
    ensure_missing_results_as_dnc,
    normalize_race_results,
)

router = APIRouter()


@router.get("/races/{race_id}/results", response_model=List[schemas.ResultRead])
def get_results_for_race(race_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc())
        .all()
    )


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
        .filter(
            models.Result.race_id == race_id,
            models.Result.sail_number == payload.sail_number,
        )
        .first()
    )

    if existing:
        existing.boat_name = payload.boat_name
        existing.skipper_name = payload.helm_name
        existing.position = int(payload.position)
        existing.points = float(payload.points)
        existing.class_name = race.class_name
        db.flush()
        normalize_race_results(db, race)
        db.commit()
        db.refresh(existing)
        return existing

    new_r = models.Result(
        regatta_id=payload.regatta_id,
        race_id=race_id,
        sail_number=payload.sail_number,
        boat_name=payload.boat_name,
        skipper_name=payload.helm_name,
        position=int(payload.position),
        points=float(payload.points),
        class_name=race.class_name,
    )
    db.add(new_r)
    db.flush()
    normalize_race_results(db, race)
    db.commit()
    db.refresh(new_r)
    return new_r


@router.post(
    "/races/{race_id}/result",
    response_model=schemas.ResultRead,
    status_code=status.HTTP_201_CREATED,
)
def add_single_result(
    race_id: int,
    payload: SingleResultCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Criação pontual de 1 resultado.
    (não faz auto-DNC para os restantes; isso acontece no bulk save /results)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter_by(id=race_id).first()
    if not race:
        raise HTTPException(404, "Corrida não encontrada")

    if payload.sail_number:
        exists = (
            db.query(models.Result)
            .filter(
                and_(
                    models.Result.race_id == race_id,
                    models.Result.sail_number == payload.sail_number,
                )
            )
            .first()
        )
        if exists:
            raise HTTPException(409, "Este barco já tem resultado nesta corrida")

    scoring_map = get_scoring_map(db, int(race.regatta_id), str(race.class_name or ""))

    code = _norm(payload.code)
    desired_pos = int(payload.desired_position)

    # calcular points
    if code:
        try:
            pts = compute_points_for_code(
                db=db,
                race=race,
                sail_number=payload.sail_number,
                code=code,
                manual_points=payload.points,
                scoring_map=scoring_map,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        pts = float(payload.points if payload.points is not None else desired_pos)

    # se remover do ranking (code != RDG) -> põe no fim (não shift)
    if removes_from_ranking(code):
        max_pos = (
            db.query(models.Result.position)
            .filter(models.Result.race_id == race_id)
            .order_by(models.Result.position.desc())
            .first()
        )
        pos = int(max_pos[0]) + 1 if max_pos and max_pos[0] is not None else 1
    else:
        # shift para abrir espaço no desired_position
        db.query(models.Result).filter(
            and_(
                models.Result.race_id == race_id,
                models.Result.position >= desired_pos,
            )
        ).update(
            {models.Result.position: models.Result.position + 1},
            synchronize_session=False,
        )
        pos = desired_pos

    new_res = models.Result(
        regatta_id=payload.regatta_id,
        race_id=race_id,
        sail_number=payload.sail_number,
        boat_name=payload.boat_name,
        class_name=race.class_name,
        skipper_name=payload.helm_name,
        position=pos,
        points=float(pts),
        code=code,
    )
    db.add(new_res)

    db.flush()
    normalize_race_results(db, race)
    db.commit()
    db.refresh(new_res)
    return new_res


@router.put("/races/{race_id}/reorder", response_model=List[schemas.ResultRead])
def reorder_race_results(
    race_id: int,
    body: ReorderBody = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(404, "Corrida não encontrada")

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

    db.flush()
    normalize_race_results(db, race)
    db.commit()

    return (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc())
        .all()
    )


@router.post("/races/{race_id}/results", response_model=List[schemas.ResultRead])
def create_results_for_race(
    race_id: int,
    results: List[schemas.ResultCreate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    BULK SAVE (rascunho -> results)
    ✅ no fim cria automaticamente DNC para os “esquecidos” (eligible confirmed+paid)
    ✅ suporta codes auto N+1 e codes ajustáveis
    ✅ compacta posições (codes != RDG vão para o fim)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter_by(id=race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    scoring_map = get_scoring_map(db, int(race.regatta_id), str(race.class_name or ""))

    existing = db.query(models.Result).filter(models.Result.race_id == race_id).all()
    by_sn: dict[str, models.Result] = {}
    for row in existing:
        snn = _norm_sn(row.sail_number)
        if snn:
            by_sn[snn] = row

    # upsert dos enviados
    for r in results:
        code = _norm(r.code)

        # points com regras novas
        try:
            if code:
                pts = compute_points_for_code(
                    db=db,
                    race=race,
                    sail_number=r.sail_number,
                    code=code,
                    manual_points=float(r.points) if r.points is not None else None,
                    scoring_map=scoring_map,
                )
            else:
                pts = float(r.points)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        sn_norm = _norm_sn(r.sail_number)

        if sn_norm and sn_norm in by_sn:
            row = by_sn[sn_norm]
            row.boat_name = r.boat_name
            row.skipper_name = r.helm_name
            row.position = int(r.position)
            row.points = float(pts)
            row.code = code
            row.class_name = race.class_name
        else:
            row = models.Result(
                regatta_id=r.regatta_id,
                race_id=race_id,
                sail_number=r.sail_number,
                boat_name=r.boat_name,
                class_name=race.class_name,
                skipper_name=r.helm_name,
                position=int(r.position),
                points=float(pts),
                code=code,
            )
            db.add(row)

    db.flush()

    # ✅ auto DNC para os esquecidos
    ensure_missing_results_as_dnc(db, race)

    # ✅ compact + recalc points
    normalize_race_results(db, race)

    db.commit()

    return (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc())
        .all()
    )
