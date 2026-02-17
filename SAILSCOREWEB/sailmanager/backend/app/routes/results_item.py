# app/routes/results_item.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user

from app.routes.results_utils import (
    PositionPatch,
    CodePatch,
    _norm,
    get_scoring_map,
    compute_points_for_code,
    removes_from_ranking,
    normalize_race_results,
)

router = APIRouter()


# ✅ Body para override de pontos (clean)
class OverridePointsPatch(BaseModel):
    points: float = Field(ge=0)


@router.delete("/{result_id}", status_code=204)
def delete_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    db.delete(row)
    db.flush()
    normalize_race_results(db, race)
    db.commit()
    return None


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

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    # se este code remove do ranking, não faz sentido mover
    if removes_from_ranking(getattr(row, "code", None)):
        raise HTTPException(
            status_code=400,
            detail="Este resultado não pode ser movido (code fora do ranking).",
        )

    new_pos = int(body.new_position)
    if new_pos < 1:
        new_pos = 1

    old_pos = int(row.position)

    if new_pos == old_pos:
        db.refresh(row)
        return row

    max_pos = (
        db.query(models.Result.position)
        .filter(models.Result.race_id == row.race_id)
        .order_by(models.Result.position.desc())
        .first()
    )
    max_pos_val = int(max_pos[0]) if max_pos and max_pos[0] is not None else 1
    if new_pos > max_pos_val:
        new_pos = max_pos_val

    if new_pos < old_pos:
        db.query(models.Result).filter(
            models.Result.race_id == row.race_id,
            models.Result.id != row.id,
            models.Result.position >= new_pos,
            models.Result.position < old_pos,
        ).update(
            {models.Result.position: models.Result.position + 1},
            synchronize_session=False,
        )
    else:
        db.query(models.Result).filter(
            models.Result.race_id == row.race_id,
            models.Result.id != row.id,
            models.Result.position > old_pos,
            models.Result.position <= new_pos,
        ).update(
            {models.Result.position: models.Result.position - 1},
            synchronize_session=False,
        )

    row.position = new_pos

    db.flush()
    normalize_race_results(db, race)

    db.commit()
    db.refresh(row)
    return row


@router.patch("/{result_id}/code", response_model=schemas.ResultRead)
def set_result_code(
    result_id: int,
    body: CodePatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    scoring_map = get_scoring_map(db, int(row.regatta_id), str(race.class_name or ""))

    raw = (body.code or "").strip()
    if raw == "":
        # limpar code => volta a ser "normal"
        row.code = None
        row.position = 10**9
        row.points = float(row.position)  # placeholder
        # ✅ se existia override manual, apaga (faz sentido)
        if hasattr(row, "points_override"):
            row.points_override = None

        db.flush()
        normalize_race_results(db, race)
        db.commit()
        db.refresh(row)
        return row

    code = _norm(raw)

    try:
        pts = compute_points_for_code(
            db=db,
            race=race,
            sail_number=row.sail_number,
            code=code,
            manual_points=body.points,
            scoring_map=scoring_map,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    row.code = code
    row.points = float(pts)

    # ✅ ao definir um code, normalmente queremos “voltar ao normal” (sem override manual)
    if hasattr(row, "points_override"):
        row.points_override = None

    if removes_from_ranking(code):
        row.position = 10**9

    db.flush()
    normalize_race_results(db, race)
    db.commit()
    db.refresh(row)
    return row


# ✅ Override points (clean): NÃO mexe em code, só em points_override + points
@router.patch("/{result_id}/override-points", response_model=schemas.ResultRead)
def override_points(
    result_id: int,
    body: OverridePointsPatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    # não faz sentido override em resultados fora do ranking (DNF/DNC/etc)
    if removes_from_ranking(getattr(row, "code", None)):
        raise HTTPException(
            status_code=400,
            detail="Este resultado está fora do ranking (DNF/DNC/etc). Não faz override de pontos aqui.",
        )

    if not hasattr(row, "points_override"):
        raise HTTPException(status_code=500, detail="Modelo Result não tem points_override")

    row.points_override = float(body.points)
    row.points = float(body.points)

    db.flush()
    normalize_race_results(db, race)
    db.commit()
    db.refresh(row)
    return row


# ✅ UNDO: limpar override (volta a calcular points pelo code/posição)
@router.delete("/{result_id}/override-points", response_model=schemas.ResultRead)
def undo_override_points(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    if not hasattr(row, "points_override"):
        raise HTTPException(status_code=500, detail="Modelo Result não tem points_override")

    row.points_override = None

    db.flush()
    normalize_race_results(db, race)
    db.commit()
    db.refresh(row)
    return row
