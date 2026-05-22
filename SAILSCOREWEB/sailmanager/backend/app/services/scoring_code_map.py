# app/services/scoring_code_map.py
"""Parse e serialização do mapa scoring_codes (número simples ou objeto com metadados)."""
from __future__ import annotations

from typing import Any, Dict, Tuple

from app.services.scoring_codes import norm_code

RESERVED_SCORING_CODES = frozenset(
    {
        "DNC",
        "DNF",
        "DNS",
        "OCS",
        "UFD",
        "BFD",
        "DSQ",
        "RET",
        "NSC",
        "DNE",
        "DGM",
        "RDG",
        "SCP",
        "ZPF",
        "DPI",
        "PRP",
    }
)


def parse_scoring_code_value(raw: Any) -> Tuple[float, bool, bool]:
    """points, discardable, shift_positions (lugares atrás sobem)."""
    if isinstance(raw, dict):
        if "points" in raw:
            pts = float(raw["points"])
        elif "value" in raw:
            pts = float(raw["value"])
        else:
            raise ValueError("Custom scoring code entry requires 'points'.")
        discardable = raw.get("discardable", True) is not False
        shift = bool(raw.get("shift_positions", False))
        return pts, discardable, shift
    try:
        return float(raw), True, False
    except (TypeError, ValueError) as e:
        raise ValueError("Invalid scoring code points value.") from e


def parse_scoring_codes_dict(
    raw: Any,
) -> Tuple[Dict[str, float], Dict[str, bool], Dict[str, bool]]:
    points: Dict[str, float] = {}
    discardable: Dict[str, bool] = {}
    shift_positions: Dict[str, bool] = {}
    if not isinstance(raw, dict):
        return points, discardable, shift_positions
    for k, v in raw.items():
        kk = norm_code(str(k))
        if not kk:
            continue
        p, d, s = parse_scoring_code_value(v)
        points[kk] = p
        discardable[kk] = d
        shift_positions[kk] = s
    return points, discardable, shift_positions


def serialize_scoring_code_entry(
    points: float,
    discardable: bool = True,
    shift_positions: bool = False,
) -> Any:
    if discardable and not shift_positions:
        return float(points)
    out: Dict[str, Any] = {"points": float(points)}
    if not discardable:
        out["discardable"] = False
    if shift_positions:
        out["shift_positions"] = True
    return out


def merge_scoring_codes_dict(*layers: Any) -> Dict[str, Any]:
    merged: Dict[str, Any] = {}
    for layer in layers:
        if not isinstance(layer, dict):
            continue
        for k, v in layer.items():
            kk = norm_code(str(k))
            if not kk:
                continue
            merged[kk] = v
    return merged


def normalize_custom_code_key(name: str) -> str:
    key = "".join((name or "").strip().upper().split())
    if len(key) < 2:
        raise ValueError("Code name must be at least 2 characters.")
    if len(key) > 16:
        raise ValueError("Code name must be at most 16 characters.")
    if key in RESERVED_SCORING_CODES:
        raise ValueError(f"Code {key} is reserved.")
    if key.startswith("PRP"):
        raise ValueError("Code cannot start with PRP (reserved for percentage penalties).")
    return key


def is_code_discardable_for_discards(
    code: Any,
    discardable_by_code: Dict[str, bool],
) -> bool:
    if not code:
        return True
    c = str(code).strip().upper()
    if c in {"DNE", "DGM"}:
        return False
    if c.startswith("PRP"):
        return True
    if c in discardable_by_code:
        return bool(discardable_by_code[c])
    return True
