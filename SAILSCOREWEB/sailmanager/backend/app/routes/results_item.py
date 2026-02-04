# app/routes/results_item.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
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

    # normaliza posições/pontos (compacta)
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

    if body.new_position < 1:
        raise HTTPException(status_code=400, detail="Posição inválida")

    # simples: atualiza e depois normalize faz o resto (compact + unranked no fim)
    row.position = int(body.new_position)

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
    """
    ✅ codes auto (N+1 / fleet+1)
    ✅ codes ajustáveis (RDG/SCP/ZPF/DPI) com points manual (decimal ok)
    ✅ qualquer code != RDG remove da sequência numérica (compacta os outros)
    """
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
        # põe no fim do ranked (normalize vai compactar)
        row.position = 10**9
        row.points = float(row.position)  # placeholder
        db.flush()
        normalize_race_results(db, race)
        db.commit()
        db.refresh(row)
        return row

    code = _norm(raw)

    # calcular points segundo as regras novas
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

    # se remove do ranking -> manda para o fim (normalize compacta)
    if removes_from_ranking(code):
        row.position = 10**9

    db.flush()
    normalize_race_results(db, race)
    db.commit()
    db.refresh(row)
    return row
