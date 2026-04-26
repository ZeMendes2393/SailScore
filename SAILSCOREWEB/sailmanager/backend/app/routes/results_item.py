# app/routes/results_item.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.org_scope import assert_user_can_manage_org_id
from utils.auth_utils import get_current_user

from app.routes.results_utils import (
    PositionPatch,
    CodePatch,
    _norm,
    get_scoring_map,
    compute_points_for_code,
    removes_from_ranking,
    normalize_race_results,
    _parse_time_to_seconds,
)

router = APIRouter()


# ✅ Body para override de pontos (clean)
class OverridePointsPatch(BaseModel):
    points: float = Field(ge=0)


class HandicapFieldsPatch(BaseModel):
    finish_day: int | None = None
    finish_time: str | None = None
    elapsed_time: str | None = None
    corrected_time: str | None = None


def _norm_time_or_none(v: str | None) -> str | None:
    s = (v or "").strip()
    return s or None


@router.delete("/{result_id}", status_code=204)
def delete_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        assert_user_can_manage_org_id(current_user, regatta.organization_id)

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
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter(models.Result.id == result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        assert_user_can_manage_org_id(current_user, regatta.organization_id)

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
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        assert_user_can_manage_org_id(current_user, regatta.organization_id)

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
            boat_country_code=getattr(row, "boat_country_code", None),
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


@router.patch("/{result_id}/handicap-fields", response_model=schemas.ResultRead)
def patch_handicap_fields(
    result_id: int,
    body: HandicapFieldsPatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        assert_user_can_manage_org_id(current_user, regatta.organization_id)

    finish_day = body.finish_day
    if finish_day is not None and int(finish_day) < 0:
        raise HTTPException(status_code=400, detail="finish_day must be >= 0")

    finish_time = _norm_time_or_none(body.finish_time)
    elapsed_time = _norm_time_or_none(body.elapsed_time)
    corrected_time = _norm_time_or_none(body.corrected_time)

    if finish_time and _parse_time_to_seconds(finish_time) is None:
        raise HTTPException(status_code=400, detail="finish_time must be HH:MM:SS")
    if elapsed_time and _parse_time_to_seconds(elapsed_time) is None:
        raise HTTPException(status_code=400, detail="elapsed_time must be HH:MM:SS")
    if corrected_time and _parse_time_to_seconds(corrected_time) is None:
        raise HTTPException(status_code=400, detail="corrected_time must be HH:MM:SS")

    if not removes_from_ranking(getattr(row, "code", None)) and not corrected_time:
        raise HTTPException(
            status_code=400,
            detail="corrected_time is required for ranked results",
        )

    row.finish_day = finish_day
    row.finish_time = finish_time
    row.elapsed_time = elapsed_time
    row.corrected_time = corrected_time

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
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        assert_user_can_manage_org_id(current_user, regatta.organization_id)

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
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    row = db.query(models.Result).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    race = db.query(models.Race).filter_by(id=row.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        assert_user_can_manage_org_id(current_user, regatta.organization_id)

    if not hasattr(row, "points_override"):
        raise HTTPException(status_code=500, detail="Modelo Result não tem points_override")

    row.points_override = None

    db.flush()
    normalize_race_results(db, race)
    db.commit()
    db.refresh(row)
    return row
