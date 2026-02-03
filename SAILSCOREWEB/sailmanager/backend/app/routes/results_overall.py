# app/routes/results_overall.py
from __future__ import annotations

from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

router = APIRouter()

# Caracter invisível para NÃO disparar o teu detector do frontend (ex: startsWith('('))
_DISCARD_INVISIBLE_PREFIX = "\u200B"

# Codes não-discardable (mesmo sendo N+1)
_NON_DISCARDABLE_CODES = {"DNE", "DGM"}


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
        .join(models.FleetAssignment, models.Entry.id == models.FleetAssignment.entry_id)
        .join(models.Fleet, models.FleetAssignment.fleet_id == models.Fleet.id)
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
    Conjunto de sail_numbers que pertencem à Medal Race (por fleet-set phase='medal').
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
# Helpers para Discards (Opção A: discard_schedule)
# =====================================================================

def _get_class_settings_model():
    Model = getattr(models, "RegattaClassSettings", None)
    if Model is not None:
        return Model
    Model = getattr(models, "RegattaClassOverride", None)
    if Model is not None:
        return Model
    return None


def _extract_schedule(raw: Any) -> List[int]:
    """
    Aceita:
      - lista JSON [0,0,0,1,1,2,...]
      - string "0,0,0,1,1,2" (por segurança)
    """
    if not raw:
        return []
    if isinstance(raw, list):
        out: List[int] = []
        for x in raw:
            try:
                out.append(max(0, int(x)))
            except Exception:
                pass
        return out

    if isinstance(raw, str):
        parts = [p.strip() for p in raw.split(",")]
        out: List[int] = []
        for p in parts:
            if not p:
                continue
            try:
                out.append(max(0, int(p)))
            except Exception:
                pass
        return out

    return []


def _schedule_discards_for_race_count(schedule: List[int], n_races: int) -> int:
    """
    schedule[i-1] = nº de descartes quando existem i races.
    Se n_races > len(schedule), usa o último valor.
    """
    if n_races <= 0 or not schedule:
        return 0

    if n_races <= len(schedule):
        return max(0, int(schedule[n_races - 1]))

    return max(0, int(schedule[-1]))


def _is_discardable_code(code: Any) -> bool:
    if not code:
        return True
    c = str(code).strip().upper()
    return c not in _NON_DISCARDABLE_CODES


def _compute_discards_fixed_count(
    ordered_race_ids: List[int],
    per_by_id: Dict[int, Dict[str, object]],
    discard_count: int,
) -> set[int]:
    """
    Escolhe os 'discard_count' piores (maior pontuação) dentro da classe,
    ignorando resultados sem score e ignorando codes não-discardable.
    """
    if discard_count <= 0:
        return set()

    candidates: List[Tuple[int, float]] = []
    for rid in ordered_race_ids:
        if rid not in per_by_id:
            continue
        if not _is_discardable_code(per_by_id[rid].get("code")):
            continue
        try:
            pts = float(per_by_id[rid]["points"])
        except Exception:
            continue
        candidates.append((rid, pts))

    if not candidates:
        return set()

    candidates.sort(key=lambda x: x[1], reverse=True)  # piores primeiro
    take = min(int(discard_count), len(candidates))
    return {rid for rid, _ in candidates[:take]}


def _fallback_discards_count_threshold(n_races: int, D: int, TH: int) -> int:
    """
    Fallback antigo: quando existem >= TH races, tens D descartes.
    """
    if D <= 0:
        return 0
    if int(TH or 0) <= 0:
        # se TH=0 (ou None), interpretamos como "sempre"
        return int(D)
    return int(D) if n_races >= int(TH) else 0


# =====================================================================
# OVERALL
# - medal race: points * 2 (aplicado no overall)
# - discards: discard_schedule (Opção A) com fallback TH+D
# - discarded aparece como "(5)" MAS com prefix invisível para não mudar cores no frontend
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

    # defaults da regata (fallback)
    reg_default_D = int(getattr(reg, "discard_count", 0) or 0)
    reg_default_TH = int(getattr(reg, "discard_threshold", 0) or 0)

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

    race_ids = [int(r.id) for r in races]
    race_map = {int(r.id): r.name for r in races}

    # races por classe
    race_ids_by_class: dict[str, List[int]] = {}
    for r in races:
        cls = str(r.class_name or "")
        race_ids_by_class.setdefault(cls, []).append(int(r.id))

    # --------------------------------------------------------
    # Settings por classe (batch)
    # --------------------------------------------------------
    SettingsModel = _get_class_settings_model()
    settings_by_class: dict[str, Any] = {}

    if SettingsModel is not None:
        classes_needed = list(race_ids_by_class.keys())
        if class_name:
            classes_needed = [str(class_name)]

        if classes_needed:
            rows = (
                db.query(SettingsModel)
                .filter(
                    SettingsModel.regatta_id == regatta_id,
                    SettingsModel.class_name.in_(classes_needed),
                )
                .all()
            )
            settings_by_class = {
                str(r.class_name): r
                for r in rows
                if getattr(r, "class_name", None)
            }

    def _resolve_discard_count_for_class(cls: str, n_races_cls: int) -> int:
        """
        Prioridade (Opção A):
          1) discard_schedule ativa e não-vazia
          2) fallback TH + D (override por classe se existir, senão defaults da regata)
        """
        cs = settings_by_class.get(cls)

        # 1) schedule
        if cs:
            active = bool(getattr(cs, "discard_schedule_active", True))
            raw = getattr(cs, "discard_schedule", None)
            schedule = _extract_schedule(raw) if active else []
            if schedule:
                return _schedule_discards_for_race_count(schedule, n_races_cls)

        # 2) fallback TH+D
        D_eff = reg_default_D
        TH_eff = reg_default_TH
        if cs:
            if getattr(cs, "discard_count", None) is not None:
                D_eff = int(cs.discard_count)
            if getattr(cs, "discard_threshold", None) is not None:
                TH_eff = int(cs.discard_threshold)
        return _fallback_discards_count_threshold(n_races_cls, int(D_eff), int(TH_eff))

    # --------------------------------------------------------
    # Medal race IDs por classe
    # --------------------------------------------------------
    medal_race_ids_by_class: dict[str, set[int]] = {}

    if class_name:
        fs_medal = (
            db.query(models.FleetSet)
            .filter(
                models.FleetSet.regatta_id == regatta_id,
                models.FleetSet.class_name == class_name,
                models.FleetSet.phase == "medal",
            )
            .order_by(models.FleetSet.created_at.desc(), models.FleetSet.id.desc())
            .first()
        )
        if fs_medal:
            ids = (
                db.query(models.Race.id)
                .filter(models.Race.fleet_set_id == fs_medal.id)
                .all()
            )
            medal_race_ids_by_class[class_name] = {int(rid) for (rid,) in ids}
        else:
            medal_race_ids_by_class[class_name] = set()
    else:
        medal_sets = (
            db.query(models.FleetSet.id, models.FleetSet.class_name)
            .filter(
                models.FleetSet.regatta_id == regatta_id,
                models.FleetSet.phase == "medal",
            )
            .order_by(
                models.FleetSet.class_name.asc(),
                models.FleetSet.created_at.desc(),
                models.FleetSet.id.desc(),
            )
            .all()
        )

        latest_by_class: dict[str, int] = {}
        for fs_id, cls in medal_sets:
            if cls and cls not in latest_by_class:
                latest_by_class[str(cls)] = int(fs_id)

        for cls, fs_id in latest_by_class.items():
            ids = (
                db.query(models.Race.id)
                .filter(models.Race.fleet_set_id == fs_id)
                .all()
            )
            medal_race_ids_by_class[cls] = {int(rid) for (rid,) in ids}

    def _multiplier_for(race_id: int, cls: str) -> float:
        return 2.0 if race_id in medal_race_ids_by_class.get(cls, set()) else 1.0

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
                fleet_by_sn_race[(str(fr.class_name), sn, int(fr.race_id))] = str(fr.fleet_name)

    # --------------------------------------------------------
    # Resultados por corrida (fonte principal)
    # --------------------------------------------------------
    pr_q = db.query(models.Result).filter(models.Result.regatta_id == regatta_id)
    if race_ids:
        pr_q = pr_q.filter(models.Result.race_id.in_(race_ids))
    if class_name:
        pr_q = pr_q.filter(models.Result.class_name == class_name)

    per_race_map: dict[tuple[str, str, str], dict[int, dict[str, object]]] = {}
    info_map: dict[tuple[str, str, str], dict[str, object]] = {}

    pr_rows = pr_q.all()
    for r in pr_rows:
        cls = str(r.class_name or "")
        sn = (r.sail_number or "").strip()
        skipper = (r.skipper_name or "").strip()
        key = (cls, sn, skipper)

        mult = _multiplier_for(int(r.race_id), cls)
        eff_pts = float(r.points) * mult  # medal x2 só no overall

        per_race_map.setdefault(key, {})[int(r.race_id)] = {
            "points": eff_pts,
            "base_points": float(r.points),
            "multiplier": mult,
            "code": getattr(r, "code", None),
        }

        if key not in info_map:
            info_map[key] = {
                "boat_name": r.boat_name,
                "class_name": r.class_name,
                "skipper_name": r.skipper_name,
                "sail_number": r.sail_number,
            }

    overall: list[dict] = []

    # ========================================================
    # FALLBACK: se ainda não há Results, construir pelas Entries
    # ========================================================
    if not pr_rows:
        entries_q = db.query(models.Entry).filter(models.Entry.regatta_id == regatta_id)
        if class_name:
            entries_q = entries_q.filter(models.Entry.class_name == class_name)

        entries_q = entries_q.filter(models.Entry.paid.is_(True))
        entries_q = entries_q.filter(models.Entry.confirmed.is_(True))

        entries = entries_q.order_by(models.Entry.sail_number.asc()).all()

        for e in entries:
            sn_norm = (e.sail_number or "").strip()
            cls = str(e.class_name or "")

            per_race_named: dict[str, object] = {}
            per_race_fleet: dict[str, object] = {}
            per_race_code: dict[str, object] = {}

            for rid in race_ids:
                rname = race_map[rid]
                per_race_named[rname] = "-"
                per_race_fleet[rname] = fleet_by_sn_race.get((cls, sn_norm, rid))
                per_race_code[rname] = None

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
                    "per_race_code": per_race_code,
                }
            )

    else:
        # pré-calcular discard_count por classe (depende só do nº de races existentes)
        discard_count_by_class: dict[str, int] = {}
        for cls, ids in race_ids_by_class.items():
            discard_count_by_class[cls] = _resolve_discard_count_for_class(cls, len(ids))

        for key, per_by_id in per_race_map.items():
            cls, sn_norm, _ = key
            info = info_map.get(key, {})

            ordered_ids_cls = race_ids_by_class.get(cls, race_ids)

            # nº de descartes pela schedule (ou fallback)
            D_cls = int(discard_count_by_class.get(cls, 0) or 0)

            # escolher piores D (respeitando non-discardable)
            discarded_ids = _compute_discards_fixed_count(ordered_ids_cls, per_by_id, D_cls)

            total_points = 0.0
            net_total = 0.0
            per_race_named: dict[str, object] = {}
            per_race_fleet: dict[str, object] = {}
            per_race_code: dict[str, object] = {}

            for rid in race_ids:
                name = race_map[rid]

                if rid not in per_by_id:
                    per_race_named[name] = "-"
                    per_race_fleet[name] = None
                    per_race_code[name] = None
                    continue

                pts = float(per_by_id[rid]["points"])
                total_points += pts

                code = per_by_id[rid].get("code")
                per_race_code[name] = code

                if rid not in discarded_ids:
                    net_total += pts
                    per_race_named[name] = pts
                else:
                    # mostra "(x)" sem disparar CSS do frontend
                    per_race_named[name] = f"{_DISCARD_INVISIBLE_PREFIX}({pts:g})"

                per_race_fleet[name] = fleet_by_sn_race.get((cls, sn_norm, rid))

            overall.append(
                {
                    "sail_number": info.get("sail_number"),
                    "boat_name": info.get("boat_name"),
                    "class_name": info.get("class_name"),
                    "skipper_name": info.get("skipper_name"),
                    "total_points": float(total_points),
                    "net_points": float(net_total),
                    "per_race": per_race_named,
                    "per_race_fleet": per_race_fleet,
                    "per_race_code": per_race_code,
                }
            )

    # ========================================================
    # LOCKING: MEDAL + FINALS
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
            float(r["net_points"]),
            float(r["total_points"]),
        )

    overall.sort(key=sort_key)

    label_for_idx = {1: "Gold", 2: "Silver", 3: "Bronze", 4: "Emerald"}

    for idx, row in enumerate(overall, start=1):
        sn = (row.get("sail_number") or "").strip()
        row["overall_rank"] = idx
        if finals_map:
            row["finals_fleet"] = label_for_idx.get(finals_map.get(sn))
        row["is_medal"] = sn in medal_set

    return overall
