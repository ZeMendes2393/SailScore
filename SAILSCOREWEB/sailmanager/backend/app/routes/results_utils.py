# app/routes/results_utils.py
from __future__ import annotations

from typing import List, Optional, Dict, Any, Tuple

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models


# =========================================================
# CODE SETS (fixos do sistema)
# =========================================================

# valem N+1 (ou fleet_size+1)
AUTO_N_PLUS_ONE_DISCARDABLE_CODES = {
    "DNC", "DNF", "DNS", "OCS", "UFD", "BFD", "DSQ", "RET", "NSC"
}

# também valem N+1, mas NÃO podem ser descartados no overall
AUTO_N_PLUS_ONE_NON_DISCARDABLE_CODES = {
    "DNE", "DGM"
}

AUTO_N_PLUS_ONE_CODES = AUTO_N_PLUS_ONE_DISCARDABLE_CODES | AUTO_N_PLUS_ONE_NON_DISCARDABLE_CODES

# precisam de points manual (pode ser decimal)
ADJUSTABLE_CODES = {"RDG", "SCP", "ZPF", "DPI"}


# =========================================================
# Normalizações
# =========================================================

def _norm(code: Optional[str]) -> Optional[str]:
    raw = (code or "").strip()
    return raw.upper() if raw else None


def _norm_sn(sn: Optional[str]) -> Optional[str]:
    raw = (sn or "").strip()
    return raw if raw else None


def removes_from_ranking(code: Optional[str]) -> bool:
    """
    Regra pedida:
      - Qualquer code diferente de RDG remove da sequência numérica
      - RDG NÃO remove
      - code=None => normal
    """
    c = _norm(code)
    return bool(c) and c != "RDG"


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

def _build_competitor_context_for_race(
    db: Session,
    race: models.Race,
) -> Dict[str, Any]:
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
    eligible_entries: List[Tuple[int, str, Optional[str], Optional[str], Optional[int]]] = []

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

        for entry_id, sn, boat_name, fn, ln, fleet_id in rows:
            sn_norm = _norm_sn(sn)
            if not sn_norm:
                continue

            fid = int(fleet_id) if fleet_id is not None else None
            if fid is not None:
                sn_to_fleet_id[sn_norm] = fid
                fleet_counts[fid] = fleet_counts.get(fid, 0) + 1

            skipper = f"{fn or ''} {ln or ''}".strip() or None
            eligible_entries.append((int(entry_id), sn_norm, boat_name, skipper, fid))

        total_count = len({sn for (_, sn, *_rest) in eligible_entries})

    else:
        rows = (
            db.query(
                models.Entry.id,
                models.Entry.sail_number,
                models.Entry.boat_name,
                models.Entry.first_name,
                models.Entry.last_name,
            )
            .filter(
                models.Entry.regatta_id == regatta_id,
                models.Entry.class_name == class_name,
                models.Entry.paid.is_(True),
                models.Entry.confirmed.is_(True),
            )
            .all()
        )

        for entry_id, sn, boat_name, fn, ln in rows:
            sn_norm = _norm_sn(sn)
            if not sn_norm:
                continue
            skipper = f"{fn or ''} {ln or ''}".strip() or None
            eligible_entries.append((int(entry_id), sn_norm, boat_name, skipper, None))

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
        if manual_points is None:
            raise ValueError(f"{c} requer points manual")
        return float(manual_points)

    if c not in scoring_map:
        raise ValueError(f"Código {c} sem pontuação definida")
    return float(scoring_map[c])


# =========================================================
# FILL: missing => DNC
# =========================================================

def ensure_missing_results_as_dnc(db: Session, race: models.Race) -> int:
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
    for (_entry_id, sn_norm, boat_name, skipper_name, _fid) in ctx["eligible_entries"]:
        if sn_norm in existing:
            continue

        pts = _auto_n_plus_one_points(ctx, sn_norm)

        row = models.Result(
            regatta_id=int(race.regatta_id),
            race_id=int(race.id),
            sail_number=sn_norm,
            boat_name=boat_name,
            class_name=str(race.class_name or ""),
            skipper_name=skipper_name,
            position=next_pos,
            points=float(pts),
            code="DNC",
        )
        db.add(row)
        next_pos += 1
        created += 1

    return created


# =========================================================
# NORMALIZE: compact + points
# =========================================================

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

    ranked = [r for r in rows if not removes_from_ranking(r.code)]
    unranked = [r for r in rows if removes_from_ranking(r.code)]

    ranked.sort(key=lambda r: (int(r.position or 0), int(r.id)))
    unranked.sort(key=lambda r: (int(r.position or 0), int(r.id)))

    pos = 1
    for r in ranked:
        r.position = pos

        c = _norm(r.code)
        if not c:
            r.points = float(pos)
        elif c in ADJUSTABLE_CODES:
            r.points = float(r.points)
        elif c in AUTO_N_PLUS_ONE_CODES:
            sn_norm = _norm_sn(r.sail_number) or ""
            r.points = float(_auto_n_plus_one_points(ctx, sn_norm))
        else:
            r.points = float(scoring_map.get(c, r.points))

        pos += 1

    for r in unranked:
        r.position = pos

        c = _norm(r.code)
        if not c:
            r.points = float(pos)
        elif c in ADJUSTABLE_CODES:
            r.points = float(r.points)
        elif c in AUTO_N_PLUS_ONE_CODES:
            sn_norm = _norm_sn(r.sail_number) or ""
            r.points = float(_auto_n_plus_one_points(ctx, sn_norm))
        else:
            r.points = float(scoring_map.get(c, r.points))

        pos += 1


# helper simples (mantém compat com código antigo)
def _points_for(mapping: Dict[str, float], code: Optional[str], pos: int) -> float:
    c = _norm(code)
    return float(mapping.get(c, pos)) if c else float(pos)
