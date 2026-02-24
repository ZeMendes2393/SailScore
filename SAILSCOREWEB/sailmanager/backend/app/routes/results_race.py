from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Union, Optional  # garante que tens isto no topo

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user

from app.routes.results_utils import (
    ResultUpsert,
    SingleResultCreate,
    ReorderBody,
    _norm,
    _norm_sn,
    _parse_time_to_seconds,
    _format_delta,
    compute_handicap_ranking,
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
        .order_by(models.Result.position.asc(), models.Result.id.asc())
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

    # Look up boat_country_code from entry
    sn_norm = _norm_sn(payload.sail_number) or payload.sail_number
    entry = (
        db.query(models.Entry)
        .filter(
            models.Entry.regatta_id == payload.regatta_id,
            models.Entry.class_name == race.class_name,
            func.lower(models.Entry.sail_number) == (sn_norm or "").lower(),
        )
        .first()
    ) if sn_norm else None
    boat_cc = getattr(entry, "boat_country_code", None) if entry else None

    new_r = models.Result(
        regatta_id=payload.regatta_id,
        race_id=race_id,
        sail_number=sn_norm,
        boat_country_code=boat_cc,
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
                    models.Result.sail_number == _norm_sn(payload.sail_number),
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

    # regra: se remover do ranking (AUTO N+1) -> põe no fim (não shift)
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

    sn_res = _norm_sn(payload.sail_number) or payload.sail_number
    entry_res = (
        db.query(models.Entry)
        .filter(
            models.Entry.regatta_id == payload.regatta_id,
            models.Entry.class_name == race.class_name,
            func.lower(models.Entry.sail_number) == (sn_res or "").lower(),
        )
        .first()
    ) if sn_res else None
    boat_cc_res = getattr(entry_res, "boat_country_code", None) if entry_res else None

    new_res = models.Result(
        regatta_id=payload.regatta_id,
        race_id=race_id,
        sail_number=sn_res,
        boat_country_code=boat_cc_res,
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
        .order_by(models.Result.position.asc(), models.Result.id.asc())
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
        .order_by(models.Result.position.asc(), models.Result.id.asc())
        .all()
    )


@router.post("/races/{race_id}/results", response_model=List[schemas.ResultRead])
def create_results_for_race(
    race_id: int,
    results: List[schemas.ResultCreate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    # ⚠️ nome TEM MESMO de ser fleet_id para bater com ?fleet_id= no frontend
    fleet_id: Union[int, str] = "all",
):
    """
    BULK SAVE (rascunho -> results)

    - Se NÃO houver fleets na corrida, ou fleet_id == "all"
        → recalc global (apaga tudo e volta a criar + DNC global)
    - Se houver fleets e vier fleet_id = número
        → só substitui resultados dos barcos do payload (essa fleet),
          e o helper ensure_missing_results_as_dnc trata dos DNCs só nessa fleet.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter_by(id=race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    # Verificar se a classe é handicap (usa tempos e corrected_time)
    regatta_class = (
        db.query(models.RegattaClass)
        .filter(
            models.RegattaClass.regatta_id == race.regatta_id,
            func.lower(models.RegattaClass.class_name) == func.lower(str(race.class_name or "")),
        )
        .first()
    )
    is_handicap = regatta_class and (regatta_class.class_type or "").lower() == "handicap"

    scoring_map = get_scoring_map(db, int(race.regatta_id), str(race.class_name or ""))

    # A corrida tem fleet_set associado?
    has_fleets = bool(getattr(race, "fleet_set_id", None))

    # Normalizar sails do payload (para deletes parciais em caso de fleet)
    payload_sails: set[str] = set()
    for r in results:
        sn = _norm_sn(r.sail_number)
        if sn:
            payload_sails.add(sn)

    # -------------------------------------------------
    # 1) RESCORE: apagar o que já existe no scope certo
    # -------------------------------------------------
    # sem fleets, ou “recalc global” → apaga tudo
    if (not has_fleets) or str(fleet_id) == "all":
        db.query(models.Result).filter(
            models.Result.race_id == race_id
        ).delete(synchronize_session=False)
    else:
        # corrida com fleets E fleet_id específico:
        # não temos coluna fleet_id na tabela results,
        # por isso apagamos apenas pelos sails que vêm no payload
        if payload_sails:
            db.query(models.Result).filter(
                models.Result.race_id == race_id,
                models.Result.sail_number.in_(payload_sails),
            ).delete(synchronize_session=False)

    db.flush()

    # ---------------------------------------------
    # 2) Validar payload + calcular pontos de cada linha
    # ---------------------------------------------
    # Chave composta (sail_number, boat_country_code) para permitir POR 2 e ESP 2 no mesmo payload
    seen_keys: set[tuple[str, str]] = set()

    for r in results:
        sn_norm = _norm_sn(r.sail_number)
        if not sn_norm:
            raise HTTPException(
                status_code=400,
                detail="sail_number em falta num dos resultados",
            )

        boat_cc_raw = getattr(r, "boat_country_code", None)
        boat_cc_norm = (boat_cc_raw or "").strip().upper() or ""
        dup_key = (sn_norm, boat_cc_norm)

        if dup_key in seen_keys:
            raise HTTPException(
                status_code=400,
                detail=f"sail_number repetido no payload: {sn_norm}" + (f" ({boat_cc_norm})" if boat_cc_norm else ""),
            )
        seen_keys.add(dup_key)

        code = _norm(getattr(r, "code", None))

        boat_cc = getattr(r, "boat_country_code", None)
        if not boat_cc:
            entry_r = (
                db.query(models.Entry)
                .filter(
                    models.Entry.regatta_id == r.regatta_id,
                    models.Entry.class_name == race.class_name,
                    func.lower(models.Entry.sail_number) == (sn_norm or "").lower(),
                )
                .first()
            )
            boat_cc = getattr(entry_r, "boat_country_code", None) if entry_r else None

        if not is_handicap:
            # One Design: usar position e points do payload
            try:
                if code:
                    pts = compute_points_for_code(
                        db=db,
                        race=race,
                        sail_number=sn_norm,
                        code=code,
                        manual_points=float(r.points) if r.points is not None else None,
                        scoring_map=scoring_map,
                    )
                else:
                    pts = float(r.position if r.points is None else r.points)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            row = models.Result(
                regatta_id=r.regatta_id,
                race_id=race_id,
                sail_number=sn_norm,
                boat_country_code=boat_cc,
                boat_name=r.boat_name,
                class_name=race.class_name,
                skipper_name=r.helm_name,
                position=int(r.position) if r.position is not None else 1,
                points=float(pts),
                code=code,
            )
            db.add(row)

    # Handicap: calcular ranking a partir de corrected_time e inserir (One Design já inserido acima)
    if is_handicap:
        items = [
            (_parse_time_to_seconds(getattr(r, "corrected_time", None)), _norm(getattr(r, "code", None)))
            for r in results
        ]
        rankings = compute_handicap_ranking(items)
        for r, (pos, delta_str, pts) in zip(results, rankings):
            sn_norm = _norm_sn(r.sail_number)
            # snapshot de dados da Entry (country code + rating)
            entry_r = (
                db.query(models.Entry)
                .filter(
                    models.Entry.regatta_id == r.regatta_id,
                    models.Entry.class_name == race.class_name,
                    func.lower(models.Entry.sail_number) == (sn_norm or "").lower(),
                )
                .first()
            ) if sn_norm else None

            boat_cc = getattr(r, "boat_country_code", None)
            if not boat_cc and entry_r is not None:
                boat_cc = getattr(entry_r, "boat_country_code", None)

            rating_val = getattr(entry_r, "rating", None) if entry_r is not None else None
            finish_day_val = getattr(r, "finish_day", None)
            if finish_day_val is not None and not isinstance(finish_day_val, int):
                try:
                    finish_day_val = int(finish_day_val)
                except (TypeError, ValueError):
                    finish_day_val = None
            row = models.Result(
                regatta_id=r.regatta_id,
                race_id=race_id,
                sail_number=sn_norm,
                boat_country_code=boat_cc,
                boat_name=r.boat_name,
                class_name=race.class_name,
                skipper_name=r.helm_name,
                rating=rating_val,
                position=pos,
                points=float(pts),
                code=_norm(getattr(r, "code", None)),
                finish_time=(getattr(r, "finish_time", None) or "").strip() or None,
                finish_day=finish_day_val,
                elapsed_time=(getattr(r, "elapsed_time", None) or "").strip() or None,
                corrected_time=(getattr(r, "corrected_time", None) or "").strip() or None,
                delta=delta_str,
                notes=(getattr(r, "notes", None) or "").strip() or None,
            )
            db.add(row)

    db.flush()

    # ---------------------------------------------
    # 3) Auto DNC para quem ficou sem resultado
    #    (helper já sabe distinguir global vs fleet, pelo fleet_id)
    # ---------------------------------------------
    ensure_missing_results_as_dnc(db, race, fleet_id)

    # ---------------------------------------------
    # 4) Compactar posições / recalcular pontos finais
    # ---------------------------------------------
    normalize_race_results(db, race)
    db.commit()

    return (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc(), models.Result.id.asc())
        .all()
    )
