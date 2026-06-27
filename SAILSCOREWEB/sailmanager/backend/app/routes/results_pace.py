from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.routes.results_overall import _get_published_at_iso, _get_published_races_count
from app.routes.results_utils import (
    _parse_time_to_seconds,
    build_eligible_result_identities,
    result_row_identity,
)

router = APIRouter()


def _clean_class_name(value: Any) -> str:
    return str(value or "").strip()


def _norm_code(value: Any) -> str:
    return str(value or "").strip().upper()


def _format_seconds(seconds: float) -> str:
    total = int(round(max(0, seconds)))
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def _get_handicap_class_names(db: Session, regatta_id: int) -> set[str]:
    rows = (
        db.query(models.RegattaClass.class_name)
        .filter(
            models.RegattaClass.regatta_id == regatta_id,
            func.lower(func.trim(models.RegattaClass.class_type)) == "handicap",
        )
        .all()
    )
    return {_clean_class_name(row[0]) for row in rows if _clean_class_name(row[0])}


def _rank_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows.sort(
        key=lambda row: (
            float(row.get("seconds_per_mile") or float("inf")),
            str(row.get("sail_number") or ""),
            str(row.get("boat_country_code") or ""),
        )
    )
    previous: float | None = None
    current_rank = 0
    for index, row in enumerate(rows):
        value = float(row.get("seconds_per_mile") or 0)
        if previous is None or value != previous:
            current_rank = index + 1
            previous = value
        row["rank"] = current_rank
    return rows


@router.get("/pace/{regatta_id}")
def get_pace_results(
    regatta_id: int,
    class_name: str | None = Query(None),
    public: bool = Query(False, description="If true, only published races for the class are included."),
    db: Session = Depends(get_db),
):
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        return {"enabled": False, "table_name": "Time per mile", "class_name": class_name, "rows": []}

    config = getattr(regatta, "results_pace_config", None) or {}
    enabled = bool(config.get("enabled"))
    table_name = _clean_class_name(config.get("table_name")) or "Time per mile"
    selected_classes = {
        _clean_class_name(value)
        for value in (config.get("class_names") or [])
        if _clean_class_name(value)
    }
    distances_by_race = config.get("distances_by_race") or {}

    if not enabled:
        return {"enabled": False, "table_name": table_name, "class_name": class_name, "rows": []}

    handicap_classes = _get_handicap_class_names(db, regatta_id)
    eligible_classes = selected_classes & handicap_classes
    if class_name:
        requested = _clean_class_name(class_name)
        eligible_classes = {requested} if requested in eligible_classes else set()

    if not eligible_classes:
        return {"enabled": True, "table_name": table_name, "class_name": class_name, "rows": []}

    races = (
        db.query(models.Race)
        .filter(models.Race.regatta_id == regatta_id, models.Race.class_name.in_(eligible_classes))
        .order_by(models.Race.class_name.asc(), models.Race.order_index.asc(), models.Race.id.asc())
        .all()
    )

    if public:
        grouped: dict[str, list[models.Race]] = {}
        for race in races:
            grouped.setdefault(_clean_class_name(race.class_name), []).append(race)
        races = []
        for cls, cls_races in grouped.items():
            count = _get_published_races_count(db, regatta_id, cls)
            if count > 0:
                races.extend(cls_races[:count])
        races.sort(key=lambda race: (_clean_class_name(race.class_name), race.order_index or 0, race.id))

    races_by_class: dict[str, list[models.Race]] = {}
    for race in races:
        races_by_class.setdefault(_clean_class_name(race.class_name), []).append(race)

    race_column_by_id: dict[int, str] = {}
    if class_name:
        race_columns = [
            {
                "column_id": str(int(race.id)),
                "race_id": int(race.id),
                "name": str(getattr(race, "name", None) or f"R{getattr(race, 'order_index', '') or race.id}"),
                "class_name": _clean_class_name(race.class_name),
                "distance": float((distances_by_race.get(_clean_class_name(race.class_name)) or {}).get(str(int(race.id))) or 0),
                "overlaid_races": [
                    {
                        "race_id": int(race.id),
                        "name": str(getattr(race, "name", None) or f"R{getattr(race, 'order_index', '') or race.id}"),
                        "class_name": _clean_class_name(race.class_name),
                    }
                ],
            }
            for race in races
        ]
        race_column_by_id = {int(race.id): str(int(race.id)) for race in races}
    else:
        ordered_classes = [cls for cls in sorted(eligible_classes) if races_by_class.get(cls)]
        max_races = max((len(races_by_class.get(cls, [])) for cls in ordered_classes), default=0)
        race_columns = []
        for index in range(max_races):
            overlaid: list[dict[str, Any]] = []
            labels: list[str] = []
            for cls in ordered_classes:
                cls_races = races_by_class.get(cls, [])
                if index >= len(cls_races):
                    continue
                race = cls_races[index]
                race_id = int(race.id)
                race_name = str(getattr(race, "name", None) or f"R{getattr(race, 'order_index', '') or race.id}")
                race_column_by_id[race_id] = f"slot-{index + 1}"
                label = f"{cls} {race_name}"
                labels.append(label)
                overlaid.append({"race_id": race_id, "name": race_name, "class_name": cls})
            race_columns.append(
                {
                    "column_id": f"slot-{index + 1}",
                    "name": f"R{index + 1}",
                    "class_name": None,
                    "distance": None,
                    "overlaid_races": overlaid,
                    "subtitle": " / ".join(labels),
                }
            )

    race_ids = [int(race.id) for race in races]
    race_by_id = {int(race.id): race for race in races}
    if not race_ids:
        return {
            "enabled": True,
            "table_name": table_name,
            "class_name": class_name,
            "published_at": _get_published_at_iso(db, regatta_id, _clean_class_name(class_name)) if public and class_name else None,
            "race_columns": [],
            "rows": [],
        }

    results = (
        db.query(models.Result)
        .filter(models.Result.regatta_id == regatta_id, models.Result.race_id.in_(race_ids))
        .all()
    )

    eligible_identities = build_eligible_result_identities(db, regatta_id, class_name)
    by_boat: dict[tuple[str, str], dict[str, Any]] = {}
    dnc_boat_keys: set[tuple[str, str]] = set()

    for result in results:
        cls = _clean_class_name(result.class_name)
        if cls not in eligible_classes:
            continue
        if result_row_identity(result) not in eligible_identities:
            continue
        key = (cls.lower(), f"{str(result.sail_number or '').strip().upper()}||{str(result.boat_country_code or '').strip().upper()}")
        if _norm_code(getattr(result, "code", None)) == "DNC":
            dnc_boat_keys.add(key)
            continue

        elapsed_seconds = _parse_time_to_seconds(getattr(result, "elapsed_time", None))
        if elapsed_seconds is None:
            continue

        race = race_by_id.get(int(result.race_id))
        if not race:
            continue
        race_name = str(getattr(race, "name", None) or f"R{getattr(race, 'order_index', '') or race.id}")
        try:
            distance = float((distances_by_race.get(cls) or {}).get(str(int(result.race_id))) or 0)
        except (TypeError, ValueError):
            distance = 0
        if distance <= 0:
            continue

        column_id = race_column_by_id.get(int(result.race_id), str(int(result.race_id)))
        row = by_boat.setdefault(
            key,
            {
                "rank": 0,
                "sail_number": result.sail_number,
                "boat_country_code": result.boat_country_code,
                "boat_name": result.boat_name,
                "class_name": cls,
                "skipper_name": result.skipper_name,
                "total_elapsed_seconds": 0.0,
                "total_distance": 0.0,
                "races_counted": 0,
                "per_race": {},
            },
        )
        row["total_elapsed_seconds"] = float(row["total_elapsed_seconds"]) + float(elapsed_seconds)
        row["total_distance"] = float(row["total_distance"]) + float(distance)
        row["races_counted"] = int(row["races_counted"]) + 1
        row["per_race"][str(int(result.race_id))] = {
            "race_id": int(result.race_id),
            "column_id": column_id,
            "race_name": race_name,
            "distance": distance,
            "elapsed_time": result.elapsed_time,
            "elapsed_seconds": elapsed_seconds,
        }

    rows: list[dict[str, Any]] = []
    for key, row in by_boat.items():
        if key in dnc_boat_keys:
            continue
        total_elapsed = float(row["total_elapsed_seconds"])
        total_distance = float(row["total_distance"])
        if total_distance <= 0:
            continue
        seconds_per_mile = total_elapsed / total_distance
        row["seconds_per_mile"] = seconds_per_mile
        row["total_elapsed_time"] = _format_seconds(total_elapsed)
        row["total_time"] = _format_seconds(total_elapsed)
        row["time_per_mile"] = _format_seconds(seconds_per_mile)
        row["miles"] = total_distance
        rows.append(row)

    return {
        "enabled": True,
        "table_name": table_name,
        "class_name": class_name,
        "published_at": _get_published_at_iso(db, regatta_id, _clean_class_name(class_name)) if public and class_name else None,
        "race_columns": race_columns,
        "rows": _rank_rows(rows),
    }
