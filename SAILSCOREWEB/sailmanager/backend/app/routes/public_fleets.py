from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FleetSet, FleetAssignment, Entry

router = APIRouter(prefix="/public", tags=["public-fleets"])

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

            boats = [
                {
                    "sail_number": e.sail_number,
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
