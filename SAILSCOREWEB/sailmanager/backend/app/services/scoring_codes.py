# app/services/scoring_codes.py
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models


# ============================================================
# Presets (os teus códigos “especiais”)
# ============================================================

# pontos = competitors(+fleet)+1  | discardable = True
N_PLUS_ONE_DISCARDABLE = {
    "DNC", "DNF", "DNS", "OCS", "UFD", "BFD", "DSQ", "RET", "NSC"
}

# pontos = competitors(+fleet)+1 | discardable = False
N_PLUS_ONE_NOT_DISCARDABLE = {"DNE", "DGM"}

# pontos = valor manual (obrigatório) | pode ser decimal
ADJUSTABLE_CODES = {"RDG", "SCP", "ZPF", "DPI"}


def norm_code(raw: str | None) -> str | None:
    c = (raw or "").strip().upper()
    return c or None


def is_adjustable(code: str | None) -> bool:
    c = norm_code(code)
    return bool(c and c in ADJUSTABLE_CODES)


def is_n_plus_one(code: str | None) -> bool:
    c = norm_code(code)
    return bool(c and (c in N_PLUS_ONE_DISCARDABLE or c in N_PLUS_ONE_NOT_DISCARDABLE))


def is_discardable(code: str | None) -> bool:
    """
    Regra que definiste:
      - DNE/DGM => NÃO discardable
      - quase todos os outros => discardable (inclui os N+1 “normais”, os ajustáveis e custom)
    """
    c = norm_code(code)
    if not c:
        return True
    if c in N_PLUS_ONE_NOT_DISCARDABLE:
        return False
    return True


# ============================================================
# Contexto com caches (para não fazer N queries por request)
# ============================================================

@dataclass
class ScoringContext:
    regatta_cache: dict[int, models.Regatta] = field(default_factory=dict)
    race_cache: dict[int, models.Race] = field(default_factory=dict)

    class_settings_cache: dict[tuple[int, str], Optional[models.RegattaClassSettings]] = field(default_factory=dict)
    effective_map_cache: dict[tuple[int, str], dict[str, float]] = field(default_factory=dict)

    class_count_cache: dict[tuple[int, str], int] = field(default_factory=dict)
    entry_id_cache: dict[tuple[int, str, str], Optional[int]] = field(default_factory=dict)

    entry_fleet_cache: dict[tuple[int, int], Optional[int]] = field(default_factory=dict)  # (entry_id, fleet_set_id) -> fleet_id
    fleet_count_cache: dict[int, int] = field(default_factory=dict)


# ============================================================
# Helpers DB
# ============================================================

def _get_regatta(db: Session, regatta_id: int, ctx: ScoringContext) -> models.Regatta:
    if regatta_id in ctx.regatta_cache:
        return ctx.regatta_cache[regatta_id]
    reg = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not reg:
        raise HTTPException(404, "Regata não encontrada")
    ctx.regatta_cache[regatta_id] = reg
    return reg


def _get_race(db: Session, race_id: int, ctx: ScoringContext) -> models.Race:
    if race_id in ctx.race_cache:
        return ctx.race_cache[race_id]
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(404, "Corrida não encontrada")
    ctx.race_cache[race_id] = race
    return race


def _get_class_settings(db: Session, regatta_id: int, class_name: str, ctx: ScoringContext) -> Optional[models.RegattaClassSettings]:
    key = (regatta_id, class_name)
    if key in ctx.class_settings_cache:
        return ctx.class_settings_cache[key]

    row = (
        db.query(models.RegattaClassSettings)
        .filter(
            models.RegattaClassSettings.regatta_id == regatta_id,
            models.RegattaClassSettings.class_name == class_name,
        )
        .first()
    )
    ctx.class_settings_cache[key] = row
    return row


def get_effective_scoring_map(db: Session, regatta_id: int, class_name: str, ctx: ScoringContext) -> dict[str, float]:
    """
    Preferência (como estás a usar no frontend):
      - se existir override por classe (scoring_codes != None), usa isso
      - senão usa regatta.scoring_codes
    """
    key = (regatta_id, class_name)
    if key in ctx.effective_map_cache:
        return ctx.effective_map_cache[key]

    reg = _get_regatta(db, regatta_id, ctx)
    cs = _get_class_settings(db, regatta_id, class_name, ctx)

    if cs is not None and cs.scoring_codes is not None:
        raw = cs.scoring_codes or {}
    else:
        raw = reg.scoring_codes or {}

    mapping: dict[str, float] = {}
    if isinstance(raw, dict):
        for k, v in raw.items():
            kk = norm_code(str(k))
            if not kk:
                continue
            try:
                mapping[kk] = float(v)
            except Exception:
                continue

    ctx.effective_map_cache[key] = mapping
    return mapping


def _class_competitors(db: Session, regatta_id: int, class_name: str, ctx: ScoringContext) -> int:
    key = (regatta_id, class_name)
    if key in ctx.class_count_cache:
        return ctx.class_count_cache[key]

    n = (
        db.query(func.count(models.Entry.id))
        .filter(
            models.Entry.regatta_id == regatta_id,
            models.Entry.class_name == class_name,
            models.Entry.paid.is_(True),
            models.Entry.confirmed.is_(True),
        )
        .scalar()
        or 0
    )
    n = int(n)
    ctx.class_count_cache[key] = n
    return n


def _entry_id_for_sn(db: Session, regatta_id: int, class_name: str, sail_number: str, ctx: ScoringContext) -> Optional[int]:
    sn = (sail_number or "").strip()
    key = (regatta_id, class_name, sn.lower())
    if key in ctx.entry_id_cache:
        return ctx.entry_id_cache[key]

    if not sn:
        ctx.entry_id_cache[key] = None
        return None

    # match case-insensitive (sqlite ok)
    entry_id = (
        db.query(models.Entry.id)
        .filter(
            models.Entry.regatta_id == regatta_id,
            models.Entry.class_name == class_name,
            func.lower(models.Entry.sail_number) == sn.lower(),
        )
        .scalar()
    )

    ctx.entry_id_cache[key] = int(entry_id) if entry_id is not None else None
    return ctx.entry_id_cache[key]


def _fleet_id_for_entry_in_fleet_set(db: Session, entry_id: int, fleet_set_id: int, ctx: ScoringContext) -> Optional[int]:
    key = (entry_id, fleet_set_id)
    if key in ctx.entry_fleet_cache:
        return ctx.entry_fleet_cache[key]

    fleet_id = (
        db.query(models.FleetAssignment.fleet_id)
        .join(models.Fleet, models.FleetAssignment.fleet_id == models.Fleet.id)
        .filter(
            models.FleetAssignment.entry_id == entry_id,
            models.Fleet.fleet_set_id == fleet_set_id,
        )
        .scalar()
    )

    ctx.entry_fleet_cache[key] = int(fleet_id) if fleet_id is not None else None
    return ctx.entry_fleet_cache[key]


def _fleet_competitors(db: Session, regatta_id: int, fleet_id: int, ctx: ScoringContext) -> int:
    if fleet_id in ctx.fleet_count_cache:
        return ctx.fleet_count_cache[fleet_id]

    n = (
        db.query(func.count(models.Entry.id))
        .join(models.FleetAssignment, models.Entry.id == models.FleetAssignment.entry_id)
        .filter(
            models.Entry.regatta_id == regatta_id,
            models.Entry.paid.is_(True),
            models.Entry.confirmed.is_(True),
            models.FleetAssignment.fleet_id == fleet_id,
        )
        .scalar()
        or 0
    )
    n = int(n)
    ctx.fleet_count_cache[fleet_id] = n
    return n


def competitors_plus_one(
    db: Session,
    regatta_id: int,
    race_id: int,
    class_name: str,
    sail_number: str,
    ctx: ScoringContext,
) -> int:
    """
    Se a race tiver fleet_set_id e o barco estiver atribuído a uma fleet desse set:
      N = nº entries (paid+confirmed) nessa fleet
    Caso contrário:
      N = nº entries (paid+confirmed) na classe
    Retorna N+1
    """
    race = _get_race(db, race_id, ctx)
    fs_id = getattr(race, "fleet_set_id", None)

    # sem fleets -> classe
    if not fs_id:
        return _class_competitors(db, regatta_id, class_name, ctx) + 1

    entry_id = _entry_id_for_sn(db, regatta_id, class_name, sail_number, ctx)
    if not entry_id:
        # sem entry => cai para classe
        return _class_competitors(db, regatta_id, class_name, ctx) + 1

    fleet_id = _fleet_id_for_entry_in_fleet_set(db, entry_id, int(fs_id), ctx)
    if not fleet_id:
        return _class_competitors(db, regatta_id, class_name, ctx) + 1

    return _fleet_competitors(db, regatta_id, int(fleet_id), ctx) + 1


# ============================================================
# Resolver principal (o que os endpoints chamam)
# ============================================================

def resolve_points(
    db: Session,
    regatta_id: int,
    race_id: int,
    class_name: str,
    sail_number: str,
    code: str | None,
    position: int,
    manual_points: float | None,
    ctx: Optional[ScoringContext] = None,
) -> float:
    """
    Regras:
      - N+1 (DNC/DNF/.../NSC) => calcula automatico (classe ou fleet)
      - DNE/DGM => N+1 mas não discardable (isso é para discards depois)
      - RDG/SCP/ZPF/DPI => manual_points obrigatório (pode ser decimal)
      - outros => usa effective scoring map (class override ou regatta map)
      - se não existir => erro 400
      - se code vazio => usa manual_points se vier (criação), senão position
    """
    ctx = ctx or ScoringContext()
    c = norm_code(code)

    # sem code
    if not c:
        if manual_points is not None:
            try:
                return float(manual_points)
            except Exception:
                return float(position)
        return float(position)

    # ajustáveis
    if c in ADJUSTABLE_CODES:
        if manual_points is None:
            raise HTTPException(400, f"Código {c} precisa de um valor (points).")
        try:
            return float(manual_points)
        except Exception:
            raise HTTPException(400, f"Valor inválido para {c}.")

    # N+1
    if c in N_PLUS_ONE_DISCARDABLE or c in N_PLUS_ONE_NOT_DISCARDABLE:
        return float(
            competitors_plus_one(db, regatta_id, race_id, class_name, sail_number, ctx)
        )

    # custom map (override por classe ou regatta)
    mapping = get_effective_scoring_map(db, regatta_id, class_name, ctx)
    if c in mapping:
        return float(mapping[c])

    raise HTTPException(400, f"Código {c} sem pontuação definida.")
