from __future__ import annotations

import csv
import io
from typing import List, Union, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Body, status, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_
from pathlib import Path

from app.database import get_db
from app import models, schemas
from app.org_scope import assert_staff_regatta_access, assert_user_can_manage_org_id
from utils.auth_utils import get_current_user
from app.services.results_pdf import build_race_results_pdf

from app.routes.results_utils import (
    ResultUpsert,
    SingleResultCreate,
    ReorderBody,
    _norm,
    _norm_sn,
    _parse_time_to_seconds,
    _format_delta,
    _build_competitor_context_for_race,
    compute_handicap_ranking,
    removes_from_ranking,
    get_scoring_map,
    compute_points_for_code,
    ensure_missing_results_as_dnc,
    normalize_race_results,
)

router = APIRouter()


def _race_export_base_label(regatta: models.Regatta | None, race: models.Race) -> str:
    reg_name = ((getattr(regatta, "name", None) or "") if regatta else "").strip() or "Regatta"
    rn = (getattr(race, "name", None) or "").strip()
    race_name = rn or f"Race {race.id}"
    cn = (getattr(race, "class_name", None) or "").strip()
    if cn:
        return f"{reg_name} - {race_name} - {cn}"
    return f"{reg_name} - {race_name}"


def _safe_race_export_filename(regatta: models.Regatta | None, race: models.Race, ext: str) -> str:
    ext = ext.lstrip(".")
    base = _race_export_base_label(regatta, race)
    safe = "".join(c if c.isalnum() or c in " -_." else "_" for c in base)
    safe = safe.strip(" ._")
    if not safe:
        safe = f"race_{race.id}_results"
    return f"{safe}.{ext}"


def _norm_cc(v: Optional[str]) -> Optional[str]:
    raw = (v or "").strip().upper()
    return raw or None


def _find_entry_for_result_identity(
    db: Session,
    *,
    regatta_id: int,
    class_name: str,
    sail_number_norm: Optional[str],
    boat_country_code: Optional[str],
    require_country_when_ambiguous: bool = True,
) -> Optional[models.Entry]:
    """
    Resolve Entry por sail_number + boat_country_code.
    Se houver colisão por sail_number e o country não vier, força 400 para evitar associações erradas.
    """
    if not sail_number_norm:
        return None

    base_q = (
        db.query(models.Entry)
        .filter(
            models.Entry.regatta_id == regatta_id,
            models.Entry.class_name == class_name,
            func.lower(models.Entry.sail_number) == sail_number_norm.lower(),
        )
    )

    cc_norm = _norm_cc(boat_country_code)
    if cc_norm:
        return (
            base_q.filter(func.upper(func.trim(models.Entry.boat_country_code)) == cc_norm)
            .first()
        )

    matches = base_q.all()
    if len(matches) > 1 and require_country_when_ambiguous:
        raise HTTPException(
            status_code=400,
            detail=(
                f"boat_country_code is required for sail_number '{sail_number_norm}' "
                "because more than one entry has the same sail number."
            ),
        )
    return matches[0] if matches else None


def _build_result_identity_filter(
    identities: set[Tuple[str, str]],
):
    clauses = []
    for sn, cc in identities:
        clauses.append(
            and_(
                models.Result.sail_number == sn,
                func.upper(func.trim(models.Result.boat_country_code)) == cc,
            )
        )
    return or_(*clauses) if clauses else None


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
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Access denied")

    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        if current_user.role in ("admin", "platform_admin"):
            assert_user_can_manage_org_id(current_user, regatta.organization_id)
        else:
            assert_staff_regatta_access(db, current_user, regatta.id)

    existing = (
        db.query(models.Result)
        .filter(
            models.Result.race_id == race_id,
            models.Result.sail_number == (_norm_sn(payload.sail_number) or payload.sail_number),
        )
    )

    payload_cc = _norm_cc(getattr(payload, "boat_country_code", None))
    if payload_cc:
        existing = existing.filter(
            func.upper(func.trim(models.Result.boat_country_code)) == payload_cc
        )
        existing = existing.first()
    else:
        existing_rows = existing.all()
        if len(existing_rows) > 1:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"boat_country_code is required for sail_number '{payload.sail_number}' "
                    "because this race already has multiple results with that sail number."
                ),
            )
        existing = existing_rows[0] if existing_rows else None

    entry = _find_entry_for_result_identity(
        db,
        regatta_id=payload.regatta_id,
        class_name=str(race.class_name or ""),
        sail_number_norm=_norm_sn(payload.sail_number),
        boat_country_code=payload_cc,
    )
    if existing:
        existing.boat_name = payload.boat_name
        existing.skipper_name = payload.helm_name
        existing.position = int(payload.position)
        existing.points = float(payload.points)
        existing.class_name = race.class_name
        if payload_cc:
            existing.boat_country_code = payload_cc
        elif entry is not None:
            existing.boat_country_code = _norm_cc(getattr(entry, "boat_country_code", None))
        db.flush()
        normalize_race_results(db, race)
        db.commit()
        db.refresh(existing)
        return existing

    sn_norm = _norm_sn(payload.sail_number) or payload.sail_number
    boat_cc = payload_cc or (_norm_cc(getattr(entry, "boat_country_code", None)) if entry else None)

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
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter_by(id=race_id).first()
    if not race:
        raise HTTPException(404, "Race not found")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        if current_user.role in ("admin", "platform_admin"):
            assert_user_can_manage_org_id(current_user, regatta.organization_id)
        else:
            assert_staff_regatta_access(db, current_user, regatta.id)

    scoring_map = get_scoring_map(db, int(race.regatta_id), str(race.class_name or ""))

    code = _norm(payload.code)
    desired_pos = int(payload.desired_position)

    sn_res = _norm_sn(payload.sail_number) or payload.sail_number
    payload_cc = _norm_cc(getattr(payload, "boat_country_code", None))
    entry_res = _find_entry_for_result_identity(
        db,
        regatta_id=payload.regatta_id,
        class_name=str(race.class_name or ""),
        sail_number_norm=_norm_sn(sn_res),
        boat_country_code=payload_cc,
    )

    if payload.sail_number:
        cc_filter = payload_cc or _norm_cc(getattr(entry_res, "boat_country_code", None))
        q = db.query(models.Result).filter(
            models.Result.race_id == race_id,
            models.Result.sail_number == sn_res,
        )
        if cc_filter:
            q = q.filter(
                func.upper(func.trim(models.Result.boat_country_code)) == cc_filter
            )
        else:
            q = q.filter(
                (models.Result.boat_country_code == None)
                | (func.trim(models.Result.boat_country_code) == "")
            )
        if q.first():
            raise HTTPException(409, "This boat already has a result in this race")

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
                boat_country_code=payload_cc or getattr(entry_res, "boat_country_code", None),
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

    boat_cc_res = payload_cc or (_norm_cc(getattr(entry_res, "boat_country_code", None)) if entry_res else None)

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
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(404, "Race not found")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        if current_user.role in ("admin", "platform_admin"):
            assert_user_can_manage_org_id(current_user, regatta.organization_id)
        else:
            assert_staff_regatta_access(db, current_user, regatta.id)

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


@router.get("/races/{race_id}/results/pdf", response_class=Response)
def get_race_results_pdf(
    race_id: int,
    db: Session = Depends(get_db),
):
    """
    Generate PDF for a single race, including handicap time fields.
    Public endpoint (no auth required).
    """
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")

    regatta = db.query(models.Regatta).filter(models.Regatta.id == race.regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")

    results = (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc(), models.Result.id.asc())
        .all()
    )
    if not results:
        raise HTTPException(status_code=404, detail="No results for this race")

    sponsors = (
        db.query(models.RegattaSponsor)
        .filter(
            or_(
                and_(
                    models.RegattaSponsor.regatta_id.is_(None),
                    models.RegattaSponsor.organization_id == regatta.organization_id,
                ),
                models.RegattaSponsor.regatta_id == race.regatta_id,
            )
        )
        .order_by(models.RegattaSponsor.category, models.RegattaSponsor.sort_order)
        .all()
    )

    uploads_dir = Path("uploads").resolve()
    pdf_bytes = build_race_results_pdf(regatta, race, results, sponsors, uploads_dir)

    filename = _safe_race_export_filename(regatta, race, "pdf")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter_by(id=race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        if current_user.role in ("admin", "platform_admin"):
            assert_user_can_manage_org_id(current_user, regatta.organization_id)
        else:
            assert_staff_regatta_access(db, current_user, regatta.id)

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

    # Normalizar identidades do payload (sail+country) para deletes parciais em caso de fleet
    payload_identities: set[Tuple[str, str]] = set()
    for r in results:
        sn = _norm_sn(r.sail_number)
        if not sn:
            continue
        cc = _norm_cc(getattr(r, "boat_country_code", None))
        if not cc:
            entry_r = _find_entry_for_result_identity(
                db,
                regatta_id=r.regatta_id,
                class_name=str(race.class_name or ""),
                sail_number_norm=sn,
                boat_country_code=None,
            )
            cc = _norm_cc(getattr(entry_r, "boat_country_code", None)) if entry_r else None
        if cc:
            payload_identities.add((sn, cc))

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
        if payload_identities:
            identity_filter = _build_result_identity_filter(payload_identities)
            if identity_filter is not None:
                db.query(models.Result).filter(
                    models.Result.race_id == race_id,
                    identity_filter,
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

        boat_cc = _norm_cc(getattr(r, "boat_country_code", None))
        entry_r = _find_entry_for_result_identity(
            db,
            regatta_id=r.regatta_id,
            class_name=str(race.class_name or ""),
            sail_number_norm=sn_norm,
            boat_country_code=boat_cc,
        )
        if not boat_cc and entry_r is not None:
            boat_cc = _norm_cc(getattr(entry_r, "boat_country_code", None))
        if not boat_cc:
            raise HTTPException(
                status_code=400,
                detail=f"boat_country_code is required for sail_number '{sn_norm}'.",
            )

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
                        boat_country_code=boat_cc,
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
        ctx = _build_competitor_context_for_race(db, race)
        items = [
            (_parse_time_to_seconds(getattr(r, "corrected_time", None)), _norm(getattr(r, "code", None)))
            for r in results
        ]
        rankings = compute_handicap_ranking(items, ctx["total_count"])
        for r, (pos, delta_str, pts) in zip(results, rankings):
            sn_norm = _norm_sn(r.sail_number)
            # snapshot de dados da Entry (country code + rating)
            boat_cc = _norm_cc(getattr(r, "boat_country_code", None))
            entry_r = _find_entry_for_result_identity(
                db,
                regatta_id=r.regatta_id,
                class_name=str(race.class_name or ""),
                sail_number_norm=sn_norm,
                boat_country_code=boat_cc,
            ) if sn_norm else None

            if not boat_cc and entry_r is not None:
                boat_cc = _norm_cc(getattr(entry_r, "boat_country_code", None))
            if not boat_cc:
                raise HTTPException(
                    status_code=400,
                    detail=f"boat_country_code is required for sail_number '{sn_norm}'.",
                )

            provided_rating = getattr(r, "rating", None)
            rating_val = provided_rating if provided_rating is not None else (getattr(entry_r, "rating", None) if entry_r is not None else None)
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


# ========== One Design CSV Export / Import (v1: this race only) ==========

def _race_is_one_design(db: Session, race: models.Race) -> bool:
    regatta_class = (
        db.query(models.RegattaClass)
        .filter(
            models.RegattaClass.regatta_id == race.regatta_id,
            func.lower(models.RegattaClass.class_name) == func.lower(str(race.class_name or "")),
        )
        .first()
    )
    return regatta_class is not None and (regatta_class.class_type or "").lower() != "handicap"


def _race_handicap_csv_columns(race: models.Race) -> list[str]:
    method = (getattr(race, "handicap_method", None) or "manual").strip().lower()
    cols = [
        "sail_number",
        "boat_country_code",
        "finish_day",
        "finish_time",
        "elapsed_time",
        "corrected_time",
        "code",
    ]
    if method in ("anc", "orc"):
        cols.append("rating")
    return cols


def _effective_entry_rating_for_race(entry: models.Entry | None, race: models.Race) -> float | None:
    if entry is None:
        return None
    method = (getattr(race, "handicap_method", None) or "manual").strip().lower()
    if method == "anc":
        val = getattr(entry, "rating", None)
    elif method == "orc":
        mode = (getattr(race, "orc_rating_mode", None) or "medium").strip().lower()
        field_map = {"low": "orc_low", "medium": "orc_medium", "high": "orc_high"}
        val = getattr(entry, field_map.get(mode, "orc_medium"), None)
    else:
        return None
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None


@router.get("/races/{race_id}/export/csv")
def export_race_results_csv(
    race_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Export this race results as CSV (one design or handicap)."""
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        if current_user.role in ("admin", "platform_admin"):
            assert_user_can_manage_org_id(current_user, regatta.organization_id)
        else:
            assert_staff_regatta_access(db, current_user, regatta.id)
    rows = (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc(), models.Result.id.asc())
        .all()
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    if _race_is_one_design(db, race):
        writer.writerow(["sail_number", "boat_country_code", "points", "code"])
        for r in rows:
            pts = r.points_override if r.points_override is not None else (r.points or 0)
            writer.writerow(
                [
                    r.sail_number or "",
                    (r.boat_country_code or "").strip().upper(),
                    str(pts),
                    (r.code or "").strip() or "",
                ]
            )
    else:
        cols = _race_handicap_csv_columns(race)
        writer.writerow(cols)
        for r in rows:
            row_map = {
                "sail_number": r.sail_number or "",
                "boat_country_code": (r.boat_country_code or "").strip().upper(),
                "finish_day": "" if r.finish_day is None else str(r.finish_day),
                "finish_time": r.finish_time or "",
                "elapsed_time": r.elapsed_time or "",
                "corrected_time": r.corrected_time or "",
                "code": (r.code or "").strip() or "",
                "rating": "" if r.rating is None else str(r.rating),
            }
            writer.writerow([row_map.get(c, "") for c in cols])
    content = buf.getvalue()
    filename = _safe_race_export_filename(regatta, race, "csv")
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _parse_one_design_csv(content: bytes) -> tuple:
    """Parse CSV with header sail_number,boat_country_code,points,code. Returns (rows, errors)."""
    errors = []
    rows = []
    try:
        text = content.decode("utf-8-sig").strip()
    except Exception as e:
        errors.append(f"File is not valid UTF-8: {e}")
        return rows, errors
    if not text:
        errors.append("File is empty.")
        return rows, errors
    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    if not header:
        errors.append("Missing header row.")
        return rows, errors
    norm_header = [h.strip().lower() for h in header]
    idx_sn = idx_cc = idx_pts = idx_code = -1
    for i, h in enumerate(norm_header):
        if h == "sail_number":
            idx_sn = i
        elif h == "boat_country_code":
            idx_cc = i
        elif h == "points":
            idx_pts = i
        elif h == "code":
            idx_code = i
    if idx_sn < 0:
        errors.append("Missing required column 'sail_number'.")
        return rows, errors
    if idx_cc < 0:
        errors.append("Missing required column 'boat_country_code'.")
        return rows, errors
    if idx_pts < 0 and idx_code < 0:
        errors.append("At least one of 'points' or 'code' is required.")
        return rows, errors
    seen_keys = set()
    for row_num, row in enumerate(reader, start=2):
        max_idx = max(idx_sn, idx_cc, idx_pts if idx_pts >= 0 else 0, idx_code if idx_code >= 0 else 0)
        if len(row) <= max_idx:
            errors.append(f"Line {row_num}: missing fields.")
            continue
        sn = (row[idx_sn] or "").strip()
        cc = (row[idx_cc] or "").strip().upper()
        if not sn:
            errors.append(f"Line {row_num}: 'sail_number' is required.")
            continue
        if not cc:
            errors.append(f"Line {row_num}: 'boat_country_code' is required.")
            continue
        sn_upper = sn.upper()
        key = (sn_upper, cc)
        if key in seen_keys:
            errors.append(f"Line {row_num}: duplicate pair '{cc} {sn_upper}'.")
            continue
        seen_keys.add(key)
        pts_val = (row[idx_pts] or "").strip() if idx_pts >= 0 else ""
        code_val = (row[idx_code] or "").strip() if idx_code >= 0 else ""
        if not pts_val and not code_val:
            errors.append(f"Line {row_num}: fill at least one of 'points' or 'code'.")
            continue
        if pts_val:
            try:
                float(pts_val)
            except ValueError:
                errors.append(f"Line {row_num}: 'points' must be numeric.")
                continue
        rows.append(
            {
                "sail_number": sn_upper,
                "boat_country_code": cc,
                "points": pts_val,
                "code": code_val.upper() if code_val else None,
            }
        )
    return rows, errors


def _parse_handicap_csv(content: bytes, columns: list[str]) -> tuple[list[dict], list[str]]:
    """Parse handicap CSV and validate format according to selected handicap mode columns."""
    errors: list[str] = []
    rows: list[dict] = []
    try:
        text = content.decode("utf-8-sig").strip()
    except Exception as e:
        errors.append(f"File is not valid UTF-8: {e}")
        return rows, errors
    if not text:
        errors.append("File is empty.")
        return rows, errors

    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    if not header:
        errors.append("Missing header row.")
        return rows, errors

    norm_header = [h.strip().lower() for h in header]
    idx_by_col: dict[str, int] = {}
    optional_cols = {"rating"}
    for c in columns:
        try:
            idx_by_col[c] = norm_header.index(c)
        except ValueError:
            if c in optional_cols:
                continue
            errors.append(f"Missing required column '{c}'.")
    if errors:
        return rows, errors

    seen_keys: set[tuple[str, str]] = set()
    for row_num, row in enumerate(reader, start=2):
        max_idx = max(idx_by_col.values())
        if len(row) <= max_idx:
            errors.append(f"Line {row_num}: missing fields.")
            continue

        row_has_error = False
        data = {c: (row[idx_by_col[c]] or "").strip() for c in columns if c in idx_by_col}
        sn = (data.get("sail_number") or "").upper()
        cc = (data.get("boat_country_code") or "").upper()

        if not sn:
            errors.append(f"Line {row_num}: 'sail_number' is required.")
            row_has_error = True
        if not cc:
            errors.append(f"Line {row_num}: 'boat_country_code' is required.")
            row_has_error = True
        if row_has_error:
            continue

        key = (sn, cc)
        if key in seen_keys:
            errors.append(f"Line {row_num}: duplicate pair '{cc} {sn}'.")
            continue
        seen_keys.add(key)

        corrected = (data.get("corrected_time") or "").strip()
        if not corrected:
            errors.append(f"Line {row_num}: 'corrected_time' is required.")
            continue
        if _parse_time_to_seconds(corrected) is None:
            errors.append(f"Line {row_num}: 'corrected_time' must be HH:MM:SS.")
            continue

        for tcol in ("finish_time", "elapsed_time"):
            tv = (data.get(tcol) or "").strip()
            if tv and _parse_time_to_seconds(tv) is None:
                errors.append(f"Line {row_num}: '{tcol}' must be HH:MM:SS.")
                row_has_error = True

        finish_day_raw = (data.get("finish_day") or "").strip()
        if finish_day_raw:
            try:
                if int(finish_day_raw) < 0:
                    raise ValueError()
            except ValueError:
                errors.append(f"Line {row_num}: 'finish_day' must be an integer >= 0.")
                row_has_error = True

        rating_raw = (data.get("rating") or "").strip()
        if "rating" in idx_by_col:
            if rating_raw:
                try:
                    float(rating_raw)
                except ValueError:
                    errors.append(f"Line {row_num}: 'rating' must be numeric.")
                    row_has_error = True

        if row_has_error:
            continue

        rows.append(
            {
                "sail_number": sn,
                "boat_country_code": cc,
                "finish_day": finish_day_raw,
                "finish_time": (data.get("finish_time") or "").strip(),
                "elapsed_time": (data.get("elapsed_time") or "").strip(),
                "corrected_time": corrected,
                "code": ((data.get("code") or "").strip().upper() or None),
                "rating": float(rating_raw) if rating_raw else None,
            }
        )

    return rows, errors


@router.post("/races/{race_id}/import/csv")
def import_race_results_csv(
    race_id: int,
    file: UploadFile = File(...),
    clear_existing: bool = Form(False),
    confirm: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Import CSV for this race (one design only).
    Without confirm: returns validation + preview.
    With confirm: applies import (upsert by sail_number); optional clear_existing.
    """
    if current_user.role not in ("admin", "platform_admin", "scorer"):
        raise HTTPException(status_code=403, detail="Access denied")
    if not file:
        raise HTTPException(status_code=400, detail="Missing file.")
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if regatta:
        if current_user.role in ("admin", "platform_admin"):
            assert_user_can_manage_org_id(current_user, regatta.organization_id)
        else:
            assert_staff_regatta_access(db, current_user, regatta.id)
    content = file.file.read()
    file.file.close()
    is_one_design = _race_is_one_design(db, race)
    if is_one_design:
        rows, parse_errors = _parse_one_design_csv(content)
        expected_columns = ["sail_number", "boat_country_code", "points", "code"]
    else:
        expected_columns = _race_handicap_csv_columns(race)
        rows, parse_errors = _parse_handicap_csv(content, expected_columns)
    if parse_errors:
        return {
            "ok": False,
            "preview": [],
            "errors": parse_errors,
            "unmatched": [],
            "columns": expected_columns,
        }
    entries = (
        db.query(models.Entry)
        .filter(
            models.Entry.regatta_id == race.regatta_id,
            func.lower(models.Entry.class_name) == func.lower(str(race.class_name or "")),
        )
        .all()
    )
    valid_keys = set()
    entry_by_key = {}
    for e in entries:
        sn = _norm_sn(getattr(e, "sail_number", None))
        cc = (getattr(e, "boat_country_code", None) or "").strip().upper()
        if sn:
            key = (sn, cc)
            valid_keys.add(key)
            entry_by_key[key] = e
    unmatched = [f'{r["boat_country_code"]} {r["sail_number"]}' for r in rows if (r["sail_number"], r["boat_country_code"]) not in valid_keys]
    missing_rating_pairs: list[str] = []
    if not is_one_design:
        method = (getattr(race, "handicap_method", None) or "manual").strip().lower()
        if method in ("anc", "orc"):
            for r in rows:
                if r.get("rating") is not None:
                    continue
                sn = r["sail_number"]
                cc = r["boat_country_code"]
                entry = entry_by_key.get((sn, cc))
                if _effective_entry_rating_for_race(entry, race) is None:
                    missing_rating_pairs.append(f"{cc} {sn}")
    if is_one_design:
        preview = [
            {
                "sail_number": r["sail_number"],
                "boat_country_code": r["boat_country_code"],
                "points": r["points"],
                "code": r["code"],
            }
            for r in rows[:15]
        ]
    else:
        preview = [{c: r.get(c, "") for c in expected_columns} for r in rows[:15]]

    if not confirm:
        err_msg: list[str] = []
        if unmatched:
            err_msg.append(f"Entry not found for sail/country pair(s): {', '.join(unmatched)}")
        if missing_rating_pairs:
            mode = (getattr(race, "handicap_method", None) or "manual").strip().lower()
            if mode == "orc":
                err_msg.append(
                    "Missing rating for ORC mode for sail/country pair(s): "
                    + ", ".join(missing_rating_pairs)
                )
            else:
                err_msg.append(
                    "Missing rating for Simple Rating mode for sail/country pair(s): "
                    + ", ".join(missing_rating_pairs)
                )
        return {
            "ok": len(unmatched) == 0 and len(missing_rating_pairs) == 0,
            "preview": preview,
            "errors": err_msg,
            "unmatched": unmatched,
            "columns": expected_columns,
        }

    if unmatched:
        raise HTTPException(
            status_code=400,
            detail=f"Import failed: entry not found for sail/country pair(s): {', '.join(unmatched)}",
        )
    if missing_rating_pairs:
        mode = (getattr(race, "handicap_method", None) or "manual").strip().lower()
        mode_label = "ORC" if mode == "orc" else "Simple Rating"
        raise HTTPException(
            status_code=400,
            detail=(
                f"Import failed: missing rating for {mode_label} mode for sail/country pair(s): "
                f"{', '.join(missing_rating_pairs)}"
            ),
        )

    if is_one_design:
        scoring_map = get_scoring_map(db, int(race.regatta_id), str(race.class_name or ""))
        if clear_existing:
            db.query(models.Result).filter(models.Result.race_id == race_id).delete(synchronize_session=False)
            db.flush()

        for i, r in enumerate(rows):
            sn = r["sail_number"]
            cc = r["boat_country_code"]
            pts_str = r["points"]
            code = _norm(r["code"]) if r["code"] else None
            entry = entry_by_key.get((sn, cc))
            boat_cc = cc
            if code:
                try:
                    pts_val = compute_points_for_code(
                        db=db,
                        race=race,
                        sail_number=sn,
                        code=code,
                        manual_points=float(pts_str) if pts_str else None,
                        scoring_map=scoring_map,
                        boat_country_code=boat_cc if boat_cc else None,
                    )
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=f"Line {i + 2}: {e}")
            else:
                pts_val = float(pts_str)
            boat_name = getattr(entry, "boat_name", None) if entry else None
            helm_name = (
                f"{getattr(entry, 'first_name', '') or ''} {getattr(entry, 'last_name', '') or ''}".strip()
                if entry else ""
            )
            existing = (
                db.query(models.Result)
                .filter(
                    models.Result.race_id == race_id,
                    models.Result.sail_number == sn,
                    models.Result.boat_country_code == cc,
                )
                .first()
            )
            if existing:
                existing.points = float(pts_val)
                existing.code = code
                existing.points_override = float(pts_val) if code else None
            else:
                new_res = models.Result(
                    regatta_id=race.regatta_id,
                    race_id=race_id,
                    sail_number=sn,
                    boat_country_code=boat_cc,
                    boat_name=boat_name,
                    class_name=race.class_name,
                    skipper_name=helm_name or None,
                    position=i + 1,
                    points=float(pts_val),
                    code=code,
                    points_override=float(pts_val) if code else None,
                )
                db.add(new_res)

        db.flush()
        normalize_race_results(db, race)
        db.commit()
    else:
        payload: list[schemas.ResultCreate] = []
        for r in rows:
            sn = r["sail_number"]
            cc = r["boat_country_code"]
            entry = entry_by_key.get((sn, cc))
            rating_val = r.get("rating")
            if rating_val is None:
                rating_val = _effective_entry_rating_for_race(entry, race)
            boat_name = getattr(entry, "boat_name", None) if entry else None
            helm_name = (
                f"{getattr(entry, 'first_name', '') or ''} {getattr(entry, 'last_name', '') or ''}".strip()
                if entry
                else ""
            )
            finish_day_val = r.get("finish_day")
            finish_day_num = int(finish_day_val) if str(finish_day_val).strip() != "" else None
            payload.append(
                schemas.ResultCreate(
                    regatta_id=race.regatta_id,
                    race_id=race_id,
                    sail_number=sn,
                    boat_country_code=cc,
                    boat_name=boat_name,
                    helm_name=helm_name or None,
                    position=None,
                    points=None,
                    code=r.get("code"),
                    finish_time=r.get("finish_time") or None,
                    finish_day=finish_day_num,
                    elapsed_time=r.get("elapsed_time") or None,
                    corrected_time=r.get("corrected_time") or None,
                    rating=rating_val,
                )
            )

        create_results_for_race(
            race_id=race_id,
            results=payload,
            db=db,
            current_user=current_user,
            fleet_id="all",
        )

    updated = (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc(), models.Result.id.asc())
        .all()
    )
    return {
        "ok": True,
        "applied": len(rows),
        "results": [schemas.ResultRead.model_validate(r) for r in updated],
        "columns": expected_columns,
    }
