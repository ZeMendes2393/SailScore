# app/services/fleets.py
import random
from typing import List, Dict, Tuple

from sqlalchemy.orm import Session

from app.models import FleetSet, Fleet, FleetAssignment, Race, Result, Entry
from app.routes.results_overall import get_overall_results_data, _sn_norm

FLEET_COLORS_QUALI = {
    2: ["Yellow", "Blue"],
    3: ["Yellow", "Blue", "Red"],
    4: ["Yellow", "Blue", "Red", "Green"],
}


def _cc_norm(v: str | None) -> str:
    return (v or "").strip().upper()


def _overall_entry_key(class_name: str, row: dict) -> Tuple[str, str, str]:
    """
    Mesma lógica de identidade do overall: classe + vela + country.
    Necessário quando há mais do que um barco com o mesmo sail_number na classe.
    """
    cls = str(class_name or row.get("class_name") or "")
    sn = _sn_norm(row.get("sail_number"))
    cc = _cc_norm(row.get("boat_country_code"))
    return (cls, sn, cc)


def list_confirmed_entries(
    db: Session,
    regatta_id: int,
    class_name: str,
) -> List[Entry]:
    return (
        db.query(Entry)
        .filter(
            Entry.regatta_id == regatta_id,
            Entry.class_name == class_name,
            Entry.paid == True,
            Entry.confirmed == True,
        )
        .all()
    )


def compute_overall_ranking(
    db: Session,
    regatta_id: int,
    class_name: str,
) -> List[int]:
    """
    Usa o mesmo ranking que o endpoint /results/overall/{regatta_id}?class_name=...
    para garantir consistência entre aquilo que o utilizador vê e o que
    é usado para reshuffle / finals.
    """
    overall_payload = get_overall_results_data(regatta_id, class_name, False, db)
    # Endpoint devolve {"rows": [...], "races_meta": ..., ...}; iterar o dict dá só as keys.
    if isinstance(overall_payload, dict):
        overall = overall_payload.get("rows") or []
    else:
        overall = overall_payload or []

    # map (classe, vela, country) -> entry_id — igual ao agrupamento em results_overall
    entry_by_key: Dict[Tuple[str, str, str], int] = {}
    for e in (
        db.query(Entry)
        .filter(
            Entry.regatta_id == regatta_id,
            Entry.class_name == class_name,
        )
        .all()
    ):
        cls = str(e.class_name or "")
        snn = _sn_norm(e.sail_number)
        ccn = _cc_norm(getattr(e, "boat_country_code", None))
        if not snn:
            continue
        entry_by_key[(cls, snn, ccn)] = int(e.id)

    ranking_ids: List[int] = []
    seen_entry: set[int] = set()
    debug_lines: List[str] = []

    for idx, row in enumerate(overall, start=1):
        if not isinstance(row, dict):
            continue
        key = _overall_entry_key(class_name, row)
        _, snn, ccn = key
        if not snn:
            continue
        eid = entry_by_key.get(key)
        if eid is None:
            # pode haver resultados sem entry correspondente (ex: barco extra)
            continue
        if eid in seen_entry:
            continue
        seen_entry.add(eid)
        ranking_ids.append(eid)
        net = float(row.get("net_points") or 0.0)
        debug_lines.append(
            f"#{idx}: entry_id={eid} sail={ccn} {snn} total={net:.2f}"
        )

    print("=== [FLEETS DEBUG] Ranking usado para reshuffle (from /results/overall) ===")
    for line in debug_lines:
        print(line)

    return ranking_ids


def _ensure_unique_label(
    db: Session,
    regatta_id: int,
    class_name: str,
    phase: str,
    base_label: str | None,
) -> str:
    """
    Garante que (regatta_id, class_name, phase, label) é único.

    Se já existir um FleetSet com o mesmo label, acrescenta sufixos:
      "Quali D1 (2)", "Quali D1 (3)", ...
    """
    base = (base_label or "").strip()
    if not base:
        base = "Unnamed"

    label = base
    i = 1
    while (
        db.query(FleetSet)
        .filter(
            FleetSet.regatta_id == regatta_id,
            FleetSet.class_name == class_name,
            FleetSet.phase == phase,
            FleetSet.label == label,
        )
        .first()
        is not None
    ):
        i += 1
        label = f"{base} ({i})"

    return label


def create_initial_set_random(
    db: Session,
    regatta_id: int,
    class_name: str,
    label: str | None,
    num_fleets: int,
) -> FleetSet:
    if num_fleets not in FLEET_COLORS_QUALI:
        raise ValueError("Número de frotas inválido para qualifying (2, 3 ou 4).")

    phase = "qualifying"
    unique_label = _ensure_unique_label(db, regatta_id, class_name, phase, label)

    fs = FleetSet(
        regatta_id=regatta_id,
        class_name=class_name,
        phase=phase,
        label=unique_label,
    )
    db.add(fs)
    db.flush()

    names = FLEET_COLORS_QUALI[num_fleets]
    fleets = [
        Fleet(fleet_set_id=fs.id, name=n, order_index=i + 1)
        for i, n in enumerate(names)
    ]
    db.add_all(fleets)
    db.flush()

    entries = list_confirmed_entries(db, regatta_id, class_name)
    random.shuffle(entries)

    # round-robin inicial
    for i, e in enumerate(entries):
        f = fleets[i % len(fleets)]
        db.add(
            FleetAssignment(
                fleet_set_id=fs.id,
                fleet_id=f.id,
                entry_id=e.id,
            )
        )

    return fs


def all_races_scored_for_set(db: Session, fleet_set_id: int) -> bool:
    race_ids = [r.id for r in db.query(Race.id).filter(Race.fleet_set_id == fleet_set_id)]
    if not race_ids:
        return True
    # considera "scored" se não há resultados com points nulos
    missing = (
        db.query(Result.id)
        .filter(Result.race_id.in_(race_ids), Result.points == None)
        .first()
    )
    return missing is None


def snake_fleet_index(index: int, num_fleets: int) -> int:
    """
    Padrão pedido:

    2 fleets (Y, B):
      Y, B, B, Y, Y, B, B, Y, ...
    3 fleets (Y, B, R):
      Y, B, R, R, B, Y, Y, B, R, ...
    4 fleets (Y, B, R, G):
      Y, B, R, G, G, R, B, Y, Y, ...

    Implementado por blocos de tamanho num_fleets, alternando normal / invertido.
    """
    if num_fleets <= 0:
        return 0

    block = index // num_fleets
    pos = index % num_fleets

    if num_fleets == 2:
        return pos if block % 2 == 0 else (1 - pos)
    elif num_fleets == 3:
        return pos if block % 2 == 0 else (2 - pos)
    elif num_fleets == 4:
        return pos if block % 2 == 0 else (3 - pos)
    else:
        return pos  # fallback genérico


def reshuffle_from_ranking(
    db: Session,
    regatta_id: int,
    class_name: str,
    prev_set_id: int,
    label: str | None,
    num_fleets: int,
) -> FleetSet:
    if num_fleets not in FLEET_COLORS_QUALI:
        raise ValueError("Número de frotas inválido para reshuffle (2, 3 ou 4).")

    # garante que todas as races ligadas ao set anterior estão scored
    if not all_races_scored_for_set(db, prev_set_id):
        raise ValueError("Há regatas do set anterior por pontuar.")

    # ranking oficial (mesma lógica que /results/overall)
    ranking = compute_overall_ranking(db, regatta_id, class_name)

    phase = "qualifying"
    unique_label = _ensure_unique_label(db, regatta_id, class_name, phase, label)

    fs = FleetSet(
        regatta_id=regatta_id,
        class_name=class_name,
        phase=phase,
        label=unique_label,
    )
    db.add(fs)
    db.flush()

    names = FLEET_COLORS_QUALI[num_fleets]
    fleets = [
        Fleet(fleet_set_id=fs.id, name=n, order_index=i + 1)
        for i, n in enumerate(names)
    ]
    db.add_all(fleets)
    db.flush()

    # aplica o padrão "snake"
    for i, entry_id in enumerate(ranking):
        fleet_idx = snake_fleet_index(i, len(fleets))
        f = fleets[fleet_idx]
        db.add(
            FleetAssignment(
                fleet_set_id=fs.id,
                fleet_id=f.id,
                entry_id=entry_id,
            )
        )

    return fs


def start_finals(
    db: Session,
    regatta_id: int,
    class_name: str,
    label: str,
    grouping: Dict[str, int],
) -> FleetSet:
    """
    Cria um FleetSet de phase='finals' e reparte o ranking atual
    pelos grupos (Gold/Silver/…).

    A partir daqui, o get_overall_results passa a respeitar
    estes grupos na ordenação final (Gold antes de Silver, etc).
    """
    phase = "finals"
    unique_label = _ensure_unique_label(db, regatta_id, class_name, phase, label)

    fs = FleetSet(
        regatta_id=regatta_id,
        class_name=class_name,
        phase=phase,
        label=unique_label,
    )
    db.add(fs)
    db.flush()

    fleets: List[Fleet] = []
    for i, (name, size) in enumerate(grouping.items()):
        fleets.append(
            Fleet(
                fleet_set_id=fs.id,
                name=name,
                order_index=i + 1,  # ordem dos grupos: 1=Gold, 2=Silver, ...
            )
        )

    db.add_all(fleets)
    db.flush()

    # ranking geral (também baseado em /results/overall)
    ranking = compute_overall_ranking(db, regatta_id, class_name)

    idx = 0
    for f in fleets:
        size = grouping.get(f.name, 0)
        if size <= 0:
            continue
        slice_ids = ranking[idx : idx + size]
        for entry_id in slice_ids:
            db.add(
                FleetAssignment(
                    fleet_set_id=fs.id,
                    fleet_id=f.id,
                    entry_id=entry_id,
                )
            )
        idx += size

    return fs
