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
    result_removes_from_ranking,
    result_row_identity,
)

router = APIRouter()


def _clean_class_name(value: Any) -> str:
    return str(value or "").strip()


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
    miles_by_class = config.get("miles_by_class") or {}

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

    race_ids = [int(race.id) for race in races]
    if not race_ids:
        return {
            "enabled": True,
            "table_name": table_name,
            "class_name": class_name,
            "published_at": _get_published_at_iso(db, regatta_id, _clean_class_name(class_name)) if public and class_name else None,
            "rows": [],
        }

    results = (
        db.query(models.Result)
        .filter(models.Result.regatta_id == regatta_id, models.Result.race_id.in_(race_ids))
        .all()
    )

    eligible_identities = build_eligible_result_identities(db, regatta_id, class_name)
    by_boat: dict[tuple[str, str], dict[str, Any]] = {}

    for result in results:
        cls = _clean_class_name(result.class_name)
        if cls not in eligible_classes:
            continue
        if result_row_identity(result) not in eligible_identities:
            continue
        if result_removes_from_ranking(result):
            continue

        elapsed_seconds = _parse_time_to_seconds(getattr(result, "elapsed_time", None))
        if elapsed_seconds is None:
            continue

        try:
            miles = float(miles_by_class.get(cls) or 0)
        except (TypeError, ValueError):
            miles = 0
        if miles <= 0:
            continue

        key = (cls.lower(), f"{str(result.sail_number or '').strip().upper()}||{str(result.boat_country_code or '').strip().upper()}")
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
                "miles": miles,
                "races_counted": 0,
            },
        )
        row["total_elapsed_seconds"] = float(row["total_elapsed_seconds"]) + float(elapsed_seconds)
        row["races_counted"] = int(row["races_counted"]) + 1

    rows: list[dict[str, Any]] = []
    for row in by_boat.values():
        total_elapsed = float(row["total_elapsed_seconds"])
        miles = float(row["miles"])
        seconds_per_mile = total_elapsed / miles
        row["seconds_per_mile"] = seconds_per_mile
        row["total_elapsed_time"] = _format_seconds(total_elapsed)
        row["time_per_mile"] = _format_seconds(seconds_per_mile)
        rows.append(row)

    return {
        "enabled": True,
        "table_name": table_name,
        "class_name": class_name,
        "published_at": _get_published_at_iso(db, regatta_id, _clean_class_name(class_name)) if public and class_name else None,
        "rows": _rank_rows(rows),
    }
