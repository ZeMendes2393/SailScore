# app/scoring/tiebreakers.py
from __future__ import annotations

from typing import Any, Dict, List, Tuple, Optional


BIG_I = 10**9
BIG_F = 10**9


# -----------------------------
# Helpers
# -----------------------------
def _safe_int(v: Any, default: int = BIG_I) -> int:
    try:
        return int(v)
    except Exception:
        return default


def _safe_float(v: Any, default: float = BIG_F) -> float:
    try:
        return float(v)
    except Exception:
        return default


def _group_by_equal(values: List[Dict[str, Any]], key_fn):
    """Agrupa lista já ordenada em blocos onde key_fn é igual."""
    out: List[List[Dict[str, Any]]] = []
    if not values:
        return out

    cur = [values[0]]
    cur_k = key_fn(values[0])

    for r in values[1:]:
        k = key_fn(r)
        if k == cur_k:
            cur.append(r)
        else:
            out.append(cur)
            cur = [r]
            cur_k = k
    out.append(cur)
    return out


# -----------------------------
# A8 (Series Ties) - baseado em POINTS (RRS)
# -----------------------------
def _a8_signature_points(
    ordered_race_ids: List[int],
    results_by_race_id: Dict[int, Dict[str, Any]],
) -> Tuple[float, ...]:
    """
    A8.1:
    - comparar os scores (points) em TODAS as corridas,
      ordenados do melhor para o pior (menor é melhor).
    - inclui corridas descartadas.
    """
    pts: List[float] = []
    for rid in ordered_race_ids:
        rr = results_by_race_id.get(rid)
        if not rr:
            pts.append(BIG_F)
            continue
        pts.append(_safe_float(rr.get("points"), BIG_F))
    pts.sort()
    return tuple(pts)


def _a8_last_race_points_key(
    ordered_race_ids: List[int],
    results_by_race_id: Dict[int, Dict[str, Any]],
) -> Tuple[float, ...]:
    """
    A8.2:
    - se ainda empatar, melhor score na última corrida, depois penúltima...
    """
    rev: List[float] = []
    for rid in reversed(ordered_race_ids):
        rr = results_by_race_id.get(rid)
        if not rr:
            rev.append(BIG_F)
            continue
        rev.append(_safe_float(rr.get("points"), BIG_F))
    return tuple(rev)


def break_tie_rrs_a8(
    tied_rows: List[Dict[str, Any]],
    *,
    ordered_race_ids: List[int],
    results_by_key: Dict[Any, Dict[int, Dict[str, Any]]],
    key_of_row,
) -> List[Dict[str, Any]]:
    """
    Desempate RRS Appendix A8 para um grupo já empatado em net_points.
    """
    def a8_key(row: Dict[str, Any]) -> Tuple:
        k = key_of_row(row)
        per = results_by_key.get(k, {})
        return (
            _a8_signature_points(ordered_race_ids, per),
            _a8_last_race_points_key(ordered_race_ids, per),
            # estabilidade (não é regra, evita “dançar”)
            str(row.get("sail_number") or ""),
            str(row.get("skipper_name") or ""),
        )

    return sorted(tied_rows, key=a8_key)


# -----------------------------
# Medal Race tie-break (house rule)
# -----------------------------
def break_tie_medal_first_then_a8(
    tied_rows: List[Dict[str, Any]],
    *,
    ordered_race_ids: List[int],
    results_by_key: Dict[Any, Dict[int, Dict[str, Any]]],
    key_of_row,
    medal_race_ids: List[int],
    medal_sail_set: Optional[set[str]] = None,
    sail_number_of_row=None,
) -> List[Dict[str, Any]]:
    """
    Regra: se existe Medal Race e TODOS os empatados são "MR sailors",
    desempata primeiro pela melhor POSITION na Medal Race.
    Se ainda empatar, aplica A8.
    """
    if not tied_rows or not medal_race_ids:
        return break_tie_rrs_a8(
            tied_rows,
            ordered_race_ids=ordered_race_ids,
            results_by_key=results_by_key,
            key_of_row=key_of_row,
        )

    # escolher a MR "principal": a última MR de acordo com ordered_race_ids
    medal_set = {int(x) for x in medal_race_ids}
    medal_main = None
    for rid in reversed(ordered_race_ids):
        if int(rid) in medal_set:
            medal_main = int(rid)
            break
    if medal_main is None:
        return break_tie_rrs_a8(
            tied_rows,
            ordered_race_ids=ordered_race_ids,
            results_by_key=results_by_key,
            key_of_row=key_of_row,
        )

    def is_mr_sailor(row: Dict[str, Any]) -> bool:
        # 1) se medal_sail_set foi fornecido, usa-o
        if medal_sail_set is not None and sail_number_of_row is not None:
            sn = (sail_number_of_row(row) or "").strip().upper()
            return sn in medal_sail_set

        # 2) fallback: considera MR sailor se tem resultado nessa MR
        k = key_of_row(row)
        per = results_by_key.get(k, {})
        return medal_main in per

    if not all(is_mr_sailor(r) for r in tied_rows):
        return break_tie_rrs_a8(
            tied_rows,
            ordered_race_ids=ordered_race_ids,
            results_by_key=results_by_key,
            key_of_row=key_of_row,
        )

    def mr_key(row: Dict[str, Any]) -> int:
        k = key_of_row(row)
        per = results_by_key.get(k, {})
        rr = per.get(medal_main, {})
        return _safe_int(rr.get("position"), BIG_I)

    primary_sorted = sorted(tied_rows, key=mr_key)

    # dentro dos que continuam empatados na MR -> A8
    out: List[Dict[str, Any]] = []
    for blk in _group_by_equal(primary_sorted, key_fn=mr_key):
        if len(blk) == 1:
            out.extend(blk)
        else:
            out.extend(
                break_tie_rrs_a8(
                    blk,
                    ordered_race_ids=ordered_race_ids,
                    results_by_key=results_by_key,
                    key_of_row=key_of_row,
                )
            )
    return out


# -----------------------------
# Main sorter for a group
# -----------------------------
def sort_overall_rows(
    rows: List[Dict[str, Any]],
    *,
    ordered_race_ids: List[int],
    results_by_key: Dict[Any, Dict[int, Dict[str, Any]]],
    key_of_row,
    medal_race_ids: Optional[List[int]] = None,
    medal_sail_set: Optional[set[str]] = None,
    sail_number_of_row=None,
) -> List[Dict[str, Any]]:
    """
    Ordena rows por:
      1) net_points asc
      2) resolve empates com:
          - MR-first (apenas MR sailors) -> A8, se medal_race_ids existe
          - senão A8
    """

    base = sorted(
        rows,
        key=lambda r: (
            _safe_float(r.get("net_points")),
            _safe_float(r.get("total_points")),
        ),
    )

    blocks = _group_by_equal(base, key_fn=lambda r: _safe_float(r.get("net_points")))

    out: List[Dict[str, Any]] = []
    for blk in blocks:
        if len(blk) == 1:
            out.extend(blk)
            continue

        if medal_race_ids:
            out.extend(
                break_tie_medal_first_then_a8(
                    blk,
                    ordered_race_ids=ordered_race_ids,
                    results_by_key=results_by_key,
                    key_of_row=key_of_row,
                    medal_race_ids=medal_race_ids,
                    medal_sail_set=medal_sail_set,
                    sail_number_of_row=sail_number_of_row,
                )
            )
        else:
            out.extend(
                break_tie_rrs_a8(
                    blk,
                    ordered_race_ids=ordered_race_ids,
                    results_by_key=results_by_key,
                    key_of_row=key_of_row,
                )
            )

    return out


def tie_signature_overall(
    row: Dict[str, Any],
    *,
    ordered_race_ids: List[int],
    results_by_key: Dict[Any, Dict[int, Dict[str, Any]]],
    key_of_row,
    medal_race_ids: Optional[List[int]] = None,
    medal_sail_set: Optional[set[str]] = None,
    sail_number_of_row=None,
) -> Tuple:
    """
    Assinatura de empate (quando tudo o que usas para desempatar dá igual).
    Se duas rows tiverem a mesma signature => empate impossível -> mesmo rank.
    """
    net = _safe_float(row.get("net_points"), BIG_F)

    # A8 (inclui discards) — é o teu critério “hard” principal para empates
    k = key_of_row(row)
    per = results_by_key.get(k, {})

    a8_sig = _a8_signature_points(ordered_race_ids, per)
    a8_last = _a8_last_race_points_key(ordered_race_ids, per)

    # MR-first: só entra se existir MR e TODOS forem MR sailors
    mr_pos = BIG_I
    if medal_race_ids:
        medal_set = {int(x) for x in medal_race_ids}
        medal_main = None
        for rid in reversed(ordered_race_ids):
            if int(rid) in medal_set:
                medal_main = int(rid)
                break

        if medal_main is not None:
            def is_mr_sailor_local() -> bool:
                if medal_sail_set is not None and sail_number_of_row is not None:
                    sn = (sail_number_of_row(row) or "").strip().upper()
                    return sn in medal_sail_set
                return medal_main in per

            if is_mr_sailor_local():
                rr = per.get(medal_main, {}) or {}
                mr_pos = _safe_int(rr.get("position"), BIG_I)

    return (net, mr_pos, a8_sig, a8_last)
