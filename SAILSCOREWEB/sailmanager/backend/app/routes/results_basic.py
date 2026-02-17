# app/routes/results_basic.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user

from app.routes.results_utils import _norm

router = APIRouter()


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

    code_map = regatta.scoring_codes or {}
    code = _norm(result.code)
    pts = float(code_map.get(code, result.points)) if code else float(result.points)

    new_result = models.Result(
        regatta_id=result.regatta_id,
        race_id=result.race_id,
        sail_number=result.sail_number,
        boat_country_code=getattr(result, "boat_country_code", None),
        boat_name=result.boat_name,
        class_name=race.class_name,
        skipper_name=result.helm_name,
        position=int(result.position),
        points=pts,
        code=code,
    )
    db.add(new_result)
    db.commit()
    db.refresh(new_result)
    return new_result


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
