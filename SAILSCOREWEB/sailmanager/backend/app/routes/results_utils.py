# app/routes/results_utils.py
from __future__ import annotations

from typing import List, Optional, Dict, Any, Tuple, Union

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models


# =========================================================
# CODE SETS (fixos do sistema)
# =========================================================

AUTO_N_PLUS_ONE_DISCARDABLE_CODES = {
    "DNC", "DNF", "DNS", "OCS", "UFD", "BFD", "DSQ", "RET", "NSC"
}

AUTO_N_PLUS_ONE_NON_DISCARDABLE_CODES = {
    "DNE", "DGM"
}

AUTO_N_PLUS_ONE_CODES = AUTO_N_PLUS_ONE_DISCARDABLE_CODES | AUTO_N_PLUS_ONE_NON_DISCARDABLE_CODES

# Ajustáveis (manual points via body.points; NÃO inclui "MAN"!)
ADJUSTABLE_CODES = {"RDG", "SCP", "ZPF", "DPI"}


# =========================================================
# Normalizações
# =========================================================

def _norm(code: Optional[str]) -> Optional[str]:
    raw = (code or "").strip()
    return raw.upper() if raw else None


def _norm_sn(sn: Optional[str]) -> Optional[str]:
    raw = (sn or "").strip()
    return raw.upper() if raw else None


# =========================================================
# Handicap / Time Scoring helpers
# =========================================================

def _parse_time_to_seconds(s: Optional[str]) -> Optional[float]:
    """Parse HH:MM:SS or H:MM:SS to total seconds. Returns None if invalid."""
    if not s or not isinstance(s, str):
        return None
    parts = (s or "").strip().split(":")
    if len(parts) == 3:
        try:
            h, m, sec = int(parts[0]), int(parts[1]), float(parts[2])
            if m < 0 or m >= 60 or sec < 0 or sec >= 60:
                return None
            return h * 3600 + m * 60 + sec
        except (ValueError, IndexError):
            return None
    if len(parts) == 2:
        try:
            m, sec = int(parts[0]), float(parts[1])
            if m < 0 or sec < 0 or sec >= 60:
                return None
            return m * 60 + sec
        except (ValueError, IndexError):
            return None
    return None


def _format_delta(seconds: float) -> str:
    """Format seconds to HH:MM:SS (delta display). 1º = 00:00:00, sem décimos."""
    if seconds < 0:
        return "—"
    total = int(round(seconds))
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def compute_handicap_ranking(
    items: List[Tuple[Optional[float], Optional[str]]]
) -> List[Tuple[int, str, float]]:
    """
    Given list of (corrected_time_seconds, code), return (position, delta_str, points).
    Codes that remove from ranking go last. Low-point: ties share points.
    """
    rankable: List[Tuple[int, Optional[float], Optional[str]]] = []
    non_rankable: List[Tuple[int, Optional[str]]] = []
    for i, (ct, code) in enumerate(items):
        if code and removes_from_ranking(code):
            non_rankable.append((i, code))
        else:
            rankable.append((i, ct, code))

    # Sort rankable by corrected time (None = DNF etc. go last)
    rankable.sort(key=lambda x: (x[1] is None, x[1] if x[1] is not None else float("inf")))

    best_corrected = None
    for _, ct, _ in rankable:
        if ct is not None:
            best_corrected = ct
            break

    n_rankable = len(rankable)
    result: List[Optional[Tuple[int, str, float]]] = [None] * len(items)

    # Assign positions and points to rankable (low-point, ties share)
    pos = 1
    idx = 0
    while idx < n_rankable:
        ct = rankable[idx][1]
        tie_count = 1
        while idx + tie_count < n_rankable and rankable[idx + tie_count][1] == ct:
            tie_count += 1
        pts_sum = sum(pos + k for k in range(tie_count))
        pts_avg = pts_sum / tie_count
        delta_str = "00:00:00" if best_corrected is None else _format_delta((ct or 0) - best_corrected)
        for k in range(tie_count):
            orig_i = rankable[idx + k][0]
            result[orig_i] = (pos, delta_str if ct is not None else "—", pts_avg)
        pos += tie_count
        idx += tie_count

    # Non-rankable: position = n_rankable + 1, etc.; points = N+1
    n_plus_one = n_rankable + 1
    for orig_i, _ in non_rankable:
        result[orig_i] = (n_plus_one, "—", float(n_plus_one))

    return [result[i] for i in range(len(items))]  # type: ignore


def removes_from_ranking(code: Optional[str]) -> bool:
    c = _norm(code)
    return bool(c) and (c in AUTO_N_PLUS_ONE_CODES)


def is_adjustable(code: Optional[str]) -> bool:
    return (_norm(code) or "") in ADJUSTABLE_CODES


def is_auto_n_plus_one(code: Optional[str]) -> bool:
    return (_norm(code) or "") in AUTO_N_PLUS_ONE_CODES


def is_non_discardable(code: Optional[str]) -> bool:
    return (_norm(code) or "") in AUTO_N_PLUS_ONE_NON_DISCARDABLE_CODES


# =========================================================
# Pydantic bodies usados nas routes
# =========================================================

class ResultUpsert(BaseModel):
    regatta_id: int
    sail_number: str
    boat_name: Optional[str] = None
    helm_name: Optional[str] = None
    position: int = Field(ge=1)
    points: float


class SingleResultCreate(BaseModel):
    regatta_id: int
    sail_number: str
    boat_name: Optional[str] = None
    helm_name: Optional[str] = None

    desired_position: int = Field(ge=1)
    points: Optional[float] = None
    code: Optional[str] = None


class ReorderBody(BaseModel):
    ordered_ids: List[int] = Field(default_factory=list)


class PositionPatch(BaseModel):
    new_position: int = Field(ge=1)


class CodePatch(BaseModel):
    """
    Para codes ajustáveis (RDG/SCP/ZPF/DPI) o frontend envia points.
    Para os outros, points pode vir null/omisso.
    """
    code: Optional[str] = None
    points: Optional[float] = Field(default=None, ge=0)


# =========================================================
# Scoring map (regatta + override por classe)
# =========================================================

def get_scoring_map(db: Session, regatta_id: int, class_name: Optional[str]) -> Dict[str, float]:
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    base: Dict[str, float] = {}
    if reg and isinstance(reg.scoring_codes, dict):
        base = {str(k).upper(): float(v) for k, v in reg.scoring_codes.items()}

    if class_name:
        SettingsModel = getattr(models, "RegattaClassSettings", None)
        if SettingsModel is not None:
            cs = (
                db.query(SettingsModel)
                .filter(
                    SettingsModel.regatta_id == regatta_id,
                    SettingsModel.class_name == class_name,
                )
                .first()
            )
            if cs and isinstance(getattr(cs, "scoring_codes", None), dict):
                override = {str(k).upper(): float(v) for k, v in (cs.scoring_codes or {}).items()}
                base = {**base, **override}

    return base


# =========================================================
# Competitors context (N e fleets)
# =========================================================

def _build_competitor_context_for_race(db: Session, race: models.Race) -> Dict[str, Any]:
    """
    devolve:
      total_count: int
      sn_to_fleet_id: dict[str, int]
      fleet_counts: dict[int, int]
      eligible_entries: list[tuple(entry_id, sail_number, boat_name, skipper_name, fleet_id|None)]
    """
    regatta_id = int(race.regatta_id)
    class_name = str(race.class_name or "")

    sn_to_fleet_id: Dict[str, int] = {}
    fleet_counts: Dict[int, int] = {}
    # (entry_id, sail_number_norm, boat_name, skipper_name, fleet_id|None, boat_country_code|None, rating|None)
    eligible_entries: List[
        Tuple[int, str, Optional[str], Optional[str], Optional[int], Optional[str], Optional[float]]
    ] = []

    if getattr(race, "fleet_set_id", None):
        fs_id = int(race.fleet_set_id)

        rows = (
            db.query(
                models.Entry.id,
                models.Entry.sail_number,
                models.Entry.boat_name,
                models.Entry.first_name,
                models.Entry.last_name,
                models.Fleet.id.label("fleet_id"),
                models.Entry.boat_country_code,
                models.Entry.rating,
            )
            .join(models.FleetAssignment, models.FleetAssignment.entry_id == models.Entry.id)
            .join(models.Fleet, models.Fleet.id == models.FleetAssignment.fleet_id)
            .filter(
                models.Entry.regatta_id == regatta_id,
                models.Entry.class_name == class_name,
                models.Entry.paid.is_(True),
                models.Entry.confirmed.is_(True),
                models.Fleet.fleet_set_id == fs_id,
            )
            .all()
        )

        for entry_id, sn, boat_name, fn, ln, fleet_id, boat_country_code, rating in rows:
            sn_norm = _norm_sn(sn)
            if not sn_norm:
                continue

            fid = int(fleet_id) if fleet_id is not None else None
            if fid is not None:
                sn_to_fleet_id[sn_norm] = fid
                fleet_counts[fid] = fleet_counts.get(fid, 0) + 1

            skipper = f"{fn or ''} {ln or ''}".strip() or None
            eligible_entries.append((int(entry_id), sn_norm, boat_name, skipper, fid, boat_country_code, rating))

        total_count = len({sn for (_, sn, *_rest) in eligible_entries})

    else:
        rows = (
            db.query(
                models.Entry.id,
                models.Entry.sail_number,
                models.Entry.boat_name,
                models.Entry.first_name,
                models.Entry.last_name,
                models.Entry.boat_country_code,
                models.Entry.rating,
            )
            .filter(
                models.Entry.regatta_id == regatta_id,
                models.Entry.class_name == class_name,
                models.Entry.paid.is_(True),
                models.Entry.confirmed.is_(True),
            )
            .all()
        )

        for entry_id, sn, boat_name, fn, ln, boat_country_code, rating in rows:
            sn_norm = _norm_sn(sn)
            if not sn_norm:
                continue
            skipper = f"{fn or ''} {ln or ''}".strip() or None
            eligible_entries.append((int(entry_id), sn_norm, boat_name, skipper, None, boat_country_code, rating))

        total_count = len({sn for (_, sn, *_rest) in eligible_entries})

    return {
        "total_count": int(total_count),
        "sn_to_fleet_id": sn_to_fleet_id,
        "fleet_counts": fleet_counts,
        "eligible_entries": eligible_entries,
    }


def _auto_n_plus_one_points(ctx: Dict[str, Any], sail_number_norm: str) -> float:
    total = int(ctx["total_count"])
    sn_to_fid: Dict[str, int] = ctx["sn_to_fleet_id"]
    fleet_counts: Dict[int, int] = ctx["fleet_counts"]

    fid = sn_to_fid.get(sail_number_norm)
    if fid is not None and fid in fleet_counts:
        return float(int(fleet_counts[fid]) + 1)

    return float(total + 1)


# =========================================================
# RDG: validação de "pontos" como posição inteira
# =========================================================

def _rdg_to_int_position(manual_points: Optional[float]) -> int:
    if manual_points is None:
        raise ValueError("RDG requer points (posição) manual")

    if float(manual_points).is_integer() is False:
        raise ValueError("RDG requer um número inteiro (posição), ex: 5")

    pos = int(manual_points)
    if pos < 1:
        raise ValueError("RDG requer posição >= 1")

    return pos


# =========================================================
# Points for code
# =========================================================

def compute_points_for_code(
    db: Session,
    race: models.Race,
    sail_number: Optional[str],
    code: str,
    manual_points: Optional[float],
    scoring_map: Dict[str, float],
    ctx: Optional[Dict[str, Any]] = None,
) -> float:
    c = _norm(code)
    if not c:
        raise ValueError("Código inválido")

    if ctx is None:
        ctx = _build_competitor_context_for_race(db, race)

    if c in AUTO_N_PLUS_ONE_CODES:
        sn_norm = _norm_sn(sail_number)
        if not sn_norm:
            raise ValueError(f"{c} requer sail_number")
        return _auto_n_plus_one_points(ctx, sn_norm)

    if c in ADJUSTABLE_CODES:
        if c == "RDG":
            return float(_rdg_to_int_position(manual_points))
        if manual_points is None:
            raise ValueError(f"{c} requer points manual")
        return float(manual_points)

    if c not in scoring_map:
        raise ValueError(f"Código {c} sem pontuação definida")
    return float(scoring_map[c])


# =========================================================
# FILL: missing => DNC
# =========================================================

def ensure_missing_results_as_dnc(
    db: Session,
    race: models.Race,
    selectedFleetId: Union[int, str],
) -> int:
    ctx = _build_competitor_context_for_race(db, race)

    existing_rows = (
        db.query(models.Result.sail_number)
        .filter(models.Result.race_id == int(race.id))
        .all()
    )
    existing = {_norm_sn(sn) for (sn,) in existing_rows if _norm_sn(sn)}

    max_pos = (
        db.query(models.Result.position)
        .filter(models.Result.race_id == int(race.id))
        .order_by(models.Result.position.desc())
        .first()
    )
    next_pos = int(max_pos[0]) + 1 if max_pos and max_pos[0] is not None else 1

    created = 0
    fleetSails = set()

    if str(selectedFleetId) != "all":
        fleetSails = {
            e.sail_number for e in db.query(models.Entry)
            .join(models.FleetAssignment, models.Entry.id == models.FleetAssignment.entry_id)
            .join(models.Fleet, models.FleetAssignment.fleet_id == models.Fleet.id)
            .filter(models.Fleet.id == int(selectedFleetId))
        }

    for (
        _entry_id,
        sn_norm,
        boat_name,
        skipper_name,
        _fid,
        boat_country_code,
        rating,
    ) in ctx["eligible_entries"]:
        if sn_norm in existing:
            continue

        if str(selectedFleetId) != "all" and sn_norm not in fleetSails:
            continue

        pts = _auto_n_plus_one_points(ctx, sn_norm)

        row = models.Result(
            regatta_id=int(race.regatta_id),
            race_id=int(race.id),
            sail_number=sn_norm,
            boat_country_code=boat_country_code,
            boat_name=boat_name,
            class_name=str(race.class_name or ""),
            skipper_name=skipper_name,
            rating=rating,
            position=next_pos,
            points=float(pts),
            code="DNC",
            points_override=None,
        )
        db.add(row)
        next_pos += 1
        created += 1

    return created


# =========================================================
# NORMALIZE: compact + points + overrides
# =========================================================

def _normalize_group(rows, scoring_map, ctx):
    ranked = [r for r in rows if not removes_from_ranking(r.code)]
    unranked = [r for r in rows if removes_from_ranking(r.code)]

    ranked.sort(key=lambda r: (int(r.position or 0), int(r.id)))

    pos = 1
    for r in ranked:
        r.position = pos
        c = _norm(getattr(r, "code", None))

        # ✅ 1) Se tiver points_override, MANDA (não muda code)
        po = getattr(r, "points_override", None)
        if po is not None:
            r.points = float(po)

        # ✅ 2) Caso normal (sem override)
        else:
            if not c:
                r.points = float(pos)
            elif c in ADJUSTABLE_CODES:
                # RDG/SCP/ZPF/DPI já guardam em r.points
                r.points = float(r.points)
            else:
                r.points = float(scoring_map.get(c, r.points))

        pos += 1

    unranked.sort(key=lambda r: (int(r.position or 0), int(r.id)))
    for r in unranked:
        r.position = pos
        c = _norm(getattr(r, "code", None))
        if c in AUTO_N_PLUS_ONE_CODES:
            sn_norm = _norm_sn(r.sail_number) or ""
            r.points = float(_auto_n_plus_one_points(ctx, sn_norm))
        else:
            r.points = float(scoring_map.get(c, r.points))
        # unranked não deve ter override a “mandar” na prática, mas se tiver, ignora
        pos += 1


def normalize_race_results(db: Session, race: models.Race) -> None:
    scoring_map = get_scoring_map(db, int(race.regatta_id), str(race.class_name or ""))
    ctx = _build_competitor_context_for_race(db, race)

    rows = (
        db.query(models.Result)
        .filter(models.Result.race_id == int(race.id))
        .order_by(models.Result.position.asc(), models.Result.id.asc())
        .all()
    )
    if not rows:
        return

    # se tem fleets: normaliza separado por fleet (sem misturar posições)
    if getattr(race, "fleet_set_id", None):
        sn_to_fid = ctx["sn_to_fleet_id"]
        by_fleet: Dict[Optional[int], List[models.Result]] = {}

        for r in rows:
            sn = _norm_sn(r.sail_number)
            fid = sn_to_fid.get(sn) if sn else None
            by_fleet.setdefault(fid, []).append(r)

        for _fid, group in by_fleet.items():
            _normalize_group(group, scoring_map, ctx)
        return

    # sem fleets: normaliza global
    _normalize_group(rows, scoring_map, ctx)
