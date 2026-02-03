# app/routes/results_item.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user

from app.routes.results_utils import PositionPatch, CodePatch, _points_for

router = APIRouter()


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

    race_id = row.race_id
    deleted_pos = int(row.position)

    reg = db.query(models.Regatta).filter_by(id=row.regatta_id).first()
    mapping = reg.scoring_codes or {}

    db.delete(row)
    db.flush()

    trailing = (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id, models.Result.position > deleted_pos)
        .order_by(models.Result.position.asc())
        .all()
    )
    for i, r in enumerate(trailing, start=1):
        new_pos = deleted_pos + i - 1
        r.position = new_pos
        r.points = _points_for(mapping, r.code, new_pos)

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

    if body.new_position < 1:
        raise HTTPException(status_code=400, detail="Posição inválida")

    race_id = row.race_id
    old_pos = int(row.position)
    new_pos = int(body.new_position)

    max_pos = (
        db.query(func.max(models.Result.position))
        .filter(models.Result.race_id == race_id)
        .scalar()
        or 0
    )
    if new_pos > max_pos:
        new_pos = max_pos

    if new_pos != old_pos:
        if new_pos > old_pos:
            db.query(models.Result).filter(
                and_(
                    models.Result.race_id == race_id,
                    models.Result.position > old_pos,
                    models.Result.position <= new_pos,
                    models.Result.id != row.id,
                )
            ).update(
                {models.Result.position: models.Result.position - 1},
                synchronize_session=False,
            )
        else:
            db.query(models.Result).filter(
                and_(
                    models.Result.race_id == race_id,
                    models.Result.position >= new_pos,
                    models.Result.position < old_pos,
                    models.Result.id != row.id,
                )
            ).update(
                {models.Result.position: models.Result.position + 1},
                synchronize_session=False,
            )

        row.position = new_pos

    reg = db.query(models.Regatta).filter_by(id=row.regatta_id).first()
    code_map = reg.scoring_codes or {}

    def points_for(mapping: dict, code: str | None, pos: int) -> float:
        return float(mapping.get(code.upper(), pos)) if code else float(pos)

    all_rows = db.query(models.Result).filter(models.Result.race_id == race_id).all()
    for r in all_rows:
        r.points = points_for(code_map, r.code, int(r.position))

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

    reg = db.query(models.Regatta).filter_by(id=row.regatta_id).first()
    mapping: dict[str, float] = reg.scoring_codes or {}

    raw = (body.code or "").strip()
    if raw == "":
        row.code = None
        row.points = float(row.position)
        db.commit()
        db.refresh(row)
        return row

    code = raw.upper()
    if code not in mapping:
        raise HTTPException(status_code=400, detail=f"Código {code} sem pontuação definida")

    race_id = row.race_id
    old_pos = int(row.position)

    db.query(models.Result).filter(
        models.Result.race_id == race_id,
        models.Result.position > old_pos,
        models.Result.id != row.id,
    ).update(
        {models.Result.position: models.Result.position - 1},
        synchronize_session=False,
    )

    max_pos = (
        db.query(func.max(models.Result.position))
        .filter(models.Result.race_id == race_id)
        .scalar()
        or 0
    )
    row.position = int(max_pos) + 1

    row.code = code
    row.points = float(mapping[code])

    db.commit()
    db.refresh(row)
    return row
