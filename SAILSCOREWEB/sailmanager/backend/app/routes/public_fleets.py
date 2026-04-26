import re

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FleetSet, FleetAssignment, Entry

router = APIRouter(prefix="/public", tags=["public-fleets"])


def _boat_sort_key(entry: Entry) -> tuple:
    sn = (entry.sail_number or "").strip()
    m = re.search(r"\d+", sn)
    num = int(m.group(0)) if m else 10**9
    cc = (getattr(entry, "boat_country_code", None) or "").strip().upper()
    return (num, cc, sn.lower())


@router.get("/regattas/{regatta_id}/fleets")
def public_fleet_sets(regatta_id: int, db: Session = Depends(get_db)):

    sets = (
        db.query(FleetSet)
        .filter(FleetSet.regatta_id == regatta_id, FleetSet.is_published == True)
        .order_by(FleetSet.published_at.desc())
        .all()
    )

    response = []

    for fs in sets:
        fleets_payload = []

        for f in fs.fleets:
            assignments = (
                db.query(FleetAssignment, Entry)
                .join(Entry, Entry.id == FleetAssignment.entry_id)
                .filter(FleetAssignment.fleet_id == f.id)
                .all()
            )
            assignments.sort(key=lambda row: _boat_sort_key(row[1]))

            boats = [
                {
                    "sail_number": e.sail_number,
                    "boat_country_code": getattr(e, "boat_country_code", None),
                    "boat_name": e.boat_name,
                    "helm_name": f"{e.first_name or ''} {e.last_name or ''}".strip(),
                }
                for (_, e) in assignments
            ]

            fleets_payload.append({
                "id": f.id,
                "name": f.name,
                "order_index": f.order_index,
                "boats": boats,
            })

        response.append({
            "id": fs.id,
            "title": fs.public_title or fs.label or "Fleets",
            "phase": fs.phase,
            "created_at": fs.published_at.isoformat() if fs.published_at else "",
            "fleets": fleets_payload,
        })

    return response
