# app/routes/results.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from typing import List, Optional

from app.database import get_db
from app import models, schemas
from utils.auth_utils import get_current_user


def _norm(s: str | None) -> str | None:
    return s.upper() if s else None


def _points_for(code_map: dict, code: str | None, position: int) -> float:
    return float(code_map.get(_norm(code), position)) if code else float(position)


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
    code: str | None = None      # <- NOVO


class PositionPatch(BaseModel):
    new_position: int


class CodePatch(BaseModel):
    code: Optional[str] = None  # permite null/(nenhum)


# =====================================================================
# Helpers para finals
# =====================================================================

def _finals_fleet_order_map(
    db: Session,
    regatta_id: int,
    class_name: str | None,
) -> dict[str, int]:
    """
    Se existir um FleetSet de phase='finals' para esta regata/classe,
    devolve um mapa sail_number -> order_index da fleet (1=Gold, 2=Silver, ...).

    Caso contrário, devolve {} e o overall é ordenado apenas por pontos.
    """
    if not class_name:
        return {}

    fs = (
        db.query(models.FleetSet)
        .filter(
            models.FleetSet.regatta_id == regatta_id,
            models.FleetSet.class_name == class_name,
            models.FleetSet.phase == "finals",
        )
        .order_by(models.FleetSet.created_at.desc(), models.FleetSet.id.desc())
        .first()
    )
    if not fs:
        return {}

    rows = (
        db.query(models.Entry.sail_number, models.Fleet.order_index)
        .join(
            models.FleetAssignment,
            models.Entry.id == models.FleetAssignment.entry_id,
        )
        .join(
            models.Fleet,
            models.FleetAssignment.fleet_id == models.Fleet.id,
        )
        .filter(
            models.Entry.regatta_id == regatta_id,
            models.Entry.class_name == class_name,
            models.Fleet.fleet_set_id == fs.id,
        )
        .all()
    )

    mapping: dict[str, int] = {}
    for sn, idx in rows:
        if sn is None:
            continue
        mapping[str(sn)] = int(idx or 0)
    return mapping

def _medal_entry_set(
    db: Session,
    regatta_id: int,
    class_name: str | None,
) -> set[str]:
    """
    Conjunto de sail_numbers que pertencem à Medal Race.
    """
    if not class_name:
        return set()

    fs = (
        db.query(models.FleetSet)
        .filter(
            models.FleetSet.regatta_id == regatta_id,
            models.FleetSet.class_name == class_name,
            models.FleetSet.phase == "medal",
        )
        .order_by(models.FleetSet.created_at.desc(), models.FleetSet.id.desc())
        .first()
    )
    if not fs:
        return set()

    rows = (
        db.query(models.Entry.sail_number)
        .join(models.FleetAssignment, models.Entry.id == models.FleetAssignment.entry_id)
        .join(models.Fleet, models.FleetAssignment.fleet_id == models.Fleet.id)
        .filter(models.Fleet.fleet_set_id == fs.id)
        .all()
    )

    return {str(sn) for (sn,) in rows if sn}



# =====================================================================
# CREATE (single)
# =====================================================================

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


# =====================================================================
# LIST BY REGATTA (optional class)
# =====================================================================

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


# =====================================================================
# LIST BY RACE
# =====================================================================

@router.get("/races/{race_id}/results", response_model=List[schemas.ResultRead])
def get_results_for_race(race_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc())
        .all()
    )


# =====================================================================
# DELETE
# =====================================================================

@router.delete("/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
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


# =====================================================================
# OVERALL (com lógica de finals locking + fleets por corrida)
# =====================================================================
@router.get("/overall/{regatta_id}")
def get_overall_results(
    regatta_id: int,
    class_name: str | None = Query(None),
    db: Session = Depends(get_db),
):
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(404, "Regata não encontrada")

    D = int(reg.discard_count or 0)
    TH = int(reg.discard_threshold or 0)

    # --------------------------------------------------------
    # Corridas consideradas
    # --------------------------------------------------------
    race_q = db.query(models.Race).filter(models.Race.regatta_id == regatta_id)
    if class_name:
        race_q = race_q.filter(models.Race.class_name == class_name)

    races = (
        race_q.order_by(
            models.Race.order_index.asc(),
            models.Race.id.asc(),
        ).all()
    )

    race_ids = [r.id for r in races]
    race_map = {r.id: r.name for r in races}

    # --------------------------------------------------------
    # Mapa (class_name, sail_number, race_id) -> fleet_name
    # --------------------------------------------------------
    fleet_by_sn_race: dict[tuple[str, str, int], str] = {}

    if race_ids:
        fleet_rows = (
            db.query(
                models.Race.id.label("race_id"),
                models.Entry.class_name.label("class_name"),
                models.Entry.sail_number.label("sail_number"),
                models.Fleet.name.label("fleet_name"),
            )
            .join(models.FleetSet, models.Race.fleet_set_id == models.FleetSet.id)
            .join(models.Fleet, models.Fleet.fleet_set_id == models.FleetSet.id)
            .join(models.FleetAssignment, models.FleetAssignment.fleet_id == models.Fleet.id)
            .join(models.Entry, models.Entry.id == models.FleetAssignment.entry_id)
            .filter(
                models.Race.regatta_id == regatta_id,
                models.Entry.regatta_id == regatta_id,
                models.Race.id.in_(race_ids),
            )
        )

        if class_name:
            fleet_rows = fleet_rows.filter(models.Entry.class_name == class_name)

        for fr in fleet_rows.all():
            sn = (fr.sail_number or "").strip()
            if sn:
                fleet_by_sn_race[(fr.class_name, sn, fr.race_id)] = fr.fleet_name

    # --------------------------------------------------------
    # Agregados (Result)
    # --------------------------------------------------------
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
        .all()
    )

    # --------------------------------------------------------
    # Resultados por corrida
    # --------------------------------------------------------
    pr_q = db.query(models.Result).filter(models.Result.regatta_id == regatta_id)
    if race_ids:
        pr_q = pr_q.filter(models.Result.race_id.in_(race_ids))
    if class_name:
        pr_q = pr_q.filter(models.Result.class_name == class_name)

    per_race_map: dict[tuple[str, str, str], dict[int, dict[str, object]]] = {}
    for r in pr_q.all():
        key = (r.class_name, (r.sail_number or "").strip(), (r.skipper_name or "").strip())
        per_race_map.setdefault(key, {})[r.race_id] = {
            "points": float(r.points),
            "code": r.code,
        }

    overall: list[dict] = []

    # ========================================================
    # ✅ FALLBACK: se ainda não há Results, construir pelas Entries
    # ========================================================
    if not agg_rows:
        entries_q = db.query(models.Entry).filter(models.Entry.regatta_id == regatta_id)
        if class_name:
            entries_q = entries_q.filter(models.Entry.class_name == class_name)

        entries = entries_q.order_by(models.Entry.sail_number.asc()).all()

        for e in entries:
            sn_norm = (e.sail_number or "").strip()
            cls = e.class_name

            per_race_named = {}
            per_race_fleet = {}

            for rid in race_ids:
                rname = race_map[rid]
                per_race_named[rname] = "-"
                per_race_fleet[rname] = fleet_by_sn_race.get((cls, sn_norm, rid))

            skipper = f"{e.first_name or ''} {e.last_name or ''}".strip() or None

            overall.append(
                {
                    "sail_number": e.sail_number,
                    "boat_name": e.boat_name,
                    "class_name": e.class_name,
                    "skipper_name": skipper,
                    "total_points": 0.0,
                    "net_points": 0.0,
                    "per_race": per_race_named,
                    "per_race_fleet": per_race_fleet,
                }
            )

    else:
        # --------------------------------------------------------
        # Normal: construir o overall pelos Results agregados
        # --------------------------------------------------------
        for row in agg_rows:
            sn_norm = (row.sail_number or "").strip()
            skipper_norm = (row.skipper_name or "").strip()
            key = (row.class_name, sn_norm, skipper_norm)

            per_by_id = per_race_map.get(key, {})
            points_list = [(rid, per_by_id[rid]["points"]) for rid in race_ids if rid in per_by_id]

            discarded_ids: set[int] = set()
            if len(points_list) >= TH and D > 0:
                worst = sorted(points_list, key=lambda x: x[1], reverse=True)[:D]
                discarded_ids = {rid for rid, _ in worst}

            net_total = 0.0
            per_race_named = {}
            per_race_fleet = {}

            for rid in race_ids:
                name = race_map[rid]
                if rid not in per_by_id:
                    per_race_named[name] = "-"
                    per_race_fleet[name] = None
                    continue

                pts = float(per_by_id[rid]["points"])
                if rid not in discarded_ids:
                    net_total += pts

                per_race_named[name] = pts
                per_race_fleet[name] = fleet_by_sn_race.get((row.class_name, sn_norm, rid))

            overall.append(
                {
                    "sail_number": row.sail_number,
                    "boat_name": row.boat_name,
                    "class_name": row.class_name,
                    "skipper_name": row.skipper_name,
                    "total_points": float(row.total_points or 0),
                    "net_points": float(net_total),
                    "per_race": per_race_named,
                    "per_race_fleet": per_race_fleet,
                }
            )

    # ========================================================
    # 🔒 LOCKING: MEDAL + FINALS
    # ========================================================
    medal_set = _medal_entry_set(db, regatta_id, class_name)
    finals_map = _finals_fleet_order_map(db, regatta_id, class_name)

    def sort_key(r: dict) -> tuple[int, int, float, float]:
        sn = (r.get("sail_number") or "").strip()

        in_medal = 0 if sn in medal_set else 1
        finals_rank = finals_map.get(sn, 9999) if finals_map else 9999

        return (
            in_medal,
            finals_rank,
            r["net_points"],
            r["total_points"],
        )

    overall.sort(key=sort_key)

    # --------------------------------------------------------
    # Rank final
    # --------------------------------------------------------
    label_for_idx = {1: "Gold", 2: "Silver", 3: "Bronze", 4: "Emerald"}

    for idx, row in enumerate(overall, start=1):
        sn = (row.get("sail_number") or "").strip()
        row["overall_rank"] = idx
        if finals_map:
            row["finals_fleet"] = label_for_idx.get(finals_map.get(sn))
        row["is_medal"] = sn in medal_set

    return overall



# =====================================================================
# UPSERT de 1 linha
# =====================================================================

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
        existing.class_name = race.class_name  # consistência
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
    db.commit()
    db.refresh(new_r)
    return new_r


# =====================================================================
# Inserir 1 resultado numa posição com shift
# =====================================================================

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

    db.query(models.Result).filter(
        and_(
            models.Result.race_id == race_id,
            models.Result.position >= payload.desired_position,
        )
    ).update(
        {models.Result.position: models.Result.position + 1},
        synchronize_session=False,
    )

    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    code_map = regatta.scoring_codes or {}
    code = _norm(payload.code)
    base_pts = float(
        payload.points if payload.points is not None else payload.desired_position
    )
    pts = float(code_map.get(code, base_pts)) if code else base_pts

    new_res = models.Result(
        regatta_id=payload.regatta_id,
        race_id=race_id,
        sail_number=payload.sail_number,
        boat_name=payload.boat_name,
        class_name=race.class_name,
        skipper_name=payload.helm_name,
        position=payload.desired_position,
        points=pts,
        code=code,
    )
    db.add(new_res)
    db.commit()
    db.refresh(new_res)
    return new_res


# =====================================================================
# Patch posição
# =====================================================================

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
            # quem estava (old_pos+1 .. new_pos) desce -1
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
            # quem estava (new_pos .. old_pos-1) sobe +1
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

        # aplica nova posição ao alvo
        row.position = new_pos

    # Recalcular pontos para TODA a corrida com base em code/posição
    reg = db.query(models.Regatta).filter_by(id=row.regatta_id).first()
    code_map = reg.scoring_codes or {}

    def points_for(mapping: dict, code: str | None, pos: int) -> float:
        return float(mapping.get(code.upper(), pos)) if code else float(pos)

    all_rows = (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .all()
    )
    for r in all_rows:
        r.points = points_for(code_map, r.code, int(r.position))

    db.commit()
    db.refresh(row)
    return row


# =====================================================================
# Patch código (DNC, DNS, etc)
# =====================================================================

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
    # limpar código
    if raw == "":
        row.code = None
        row.points = float(row.position)
        db.commit()
        db.refresh(row)
        return row

    code = raw.upper()
    if code not in mapping:
        raise HTTPException(
            status_code=400,
            detail=f"Código {code} sem pontuação definida",
        )

    race_id = row.race_id
    old_pos = int(row.position)

    # 1) Comprimir ranking
    (
        db.query(models.Result)
        .filter(
            models.Result.race_id == race_id,
            models.Result.position > old_pos,
            models.Result.id != row.id,
        )
        .update(
            {models.Result.position: models.Result.position - 1},
            synchronize_session=False,
        )
    )

    # 2) Empurrar o marcado para o fim
    max_pos = (
        db.query(func.max(models.Result.position))
        .filter(models.Result.race_id == race_id)
        .scalar()
        or 0
    )
    row.position = int(max_pos) + 1

    # 3) Aplicar código e pontos do mapa
    row.code = code
    row.points = float(mapping[code])

    db.commit()
    db.refresh(row)
    return row


# =====================================================================
# Reorder global de uma Race
# =====================================================================

class ReorderBody(BaseModel):
    ordered_ids: List[int]


@router.put(
    "/races/{race_id}/reorder",
    response_model=List[schemas.ResultRead],
)
def reorder_race_results(
    race_id: int,
    body: ReorderBody = Body(...),
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
        raise HTTPException(
            400,
            "Lista ordered_ids tem de conter exatamente os IDs atuais",
        )

    regatta_id = rows[0].regatta_id if rows else None
    mapping = {}
    if regatta_id:
        reg = db.query(models.Regatta).filter_by(id=regatta_id).first()
        mapping = reg.scoring_codes or {}

    pos_map = {rid: i + 1 for i, rid in enumerate(body.ordered_ids)}
    for r in rows:
        r.position = pos_map[r.id]
        r.points = _points_for(mapping, r.code, r.position)

    db.commit()

    return (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc())
        .all()
    )


# =====================================================================
# Inserção em massa (race)
# =====================================================================

def _norm_sn(v: str | None) -> str | None:
    if not v:
        return None
    return str(v).strip().upper()


@router.post(
    "/races/{race_id}/results",
    response_model=List[schemas.ResultRead],
)
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

    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    code_map = regatta.scoring_codes or {}

    existing = (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .all()
    )
    by_sn: dict[str, models.Result] = {}
    for row in existing:
        norm = _norm_sn(row.sail_number)
        if norm:
            by_sn[norm] = row

    for r in results:
        code = _norm(r.code)
        base_pts = float(r.points)
        pts = float(code_map.get(code, base_pts)) if code else base_pts

        sn_norm = _norm_sn(r.sail_number)
        if sn_norm and sn_norm in by_sn:
            # UPDATE
            row = by_sn[sn_norm]
            row.boat_name = r.boat_name
            row.skipper_name = r.helm_name
            row.position = int(r.position)
            row.points = pts
            row.code = code
            row.class_name = race.class_name
        else:
            # INSERT
            row = models.Result(
                regatta_id=r.regatta_id,
                race_id=race_id,
                sail_number=r.sail_number,
                boat_name=r.boat_name,
                class_name=race.class_name,
                skipper_name=r.helm_name,
                position=int(r.position),
                points=pts,
                code=code,
            )
            db.add(row)

    db.commit()

    return (
        db.query(models.Result)
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.position.asc())
        .all()
    )
