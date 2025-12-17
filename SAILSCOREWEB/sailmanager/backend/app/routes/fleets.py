# app/routes/fleets.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from sqlalchemy import func
import sqlalchemy as sa

from app.database import get_db
from app.models import FleetSet, FleetAssignment, Race, Result, Fleet
from app.services.fleets import (
    create_initial_set_random,
    reshuffle_from_ranking,
    start_finals,
)
from app.schemas import (
    FleetSetRead,
    CreateQualifyingSetIn,
    ReshuffleIn,
    StartFinalsIn,
)
from pydantic import BaseModel

router = APIRouter(prefix="/regattas", tags=["fleets"])


# -------------------------
# Helpers
# -------------------------
def _attach_races_to_set(db: Session, race_ids: List[int], set_id: int) -> None:
    if not race_ids:
        return
    (
        db.query(Race)
        .filter(Race.id.in_(race_ids))
        .update({"fleet_set_id": set_id}, synchronize_session=False)
    )
    db.commit()


def _validate_races_same_regatta_and_class(
    db: Session, regatta_id: int, class_name: str, race_ids: List[int]
) -> None:
    if not race_ids:
        return
    rows = (
        db.query(Race.id, Race.regatta_id, Race.class_name)
        .filter(Race.id.in_(race_ids))
        .all()
    )
    if len(rows) != len(race_ids):
        raise HTTPException(status_code=400, detail="Alguma race_id é inválida.")
    for rid, rreg, rcls in rows:
        if int(rreg) != int(regatta_id) or str(rcls) != str(class_name):
            raise HTTPException(
                status_code=400,
                detail=f"Race {rid} não pertence à regata/classe indicada.",
            )


def _fleet_set_stats(db: Session, set_id: int) -> dict:
    races = db.query(Race.id).filter(Race.fleet_set_id == set_id).all()
    race_ids = [r.id for r in races]
    if not race_ids:
        return {"race_count": 0, "result_count": 0}

    result_count = (
        db.query(func.count(Result.id))
        .filter(Result.race_id.in_(race_ids))
        .scalar()
        or 0
    )
    return {"race_count": len(race_ids), "result_count": int(result_count)}


# -------------------------
# Endpoints principais
# -------------------------
@router.post(
    "/{regatta_id}/classes/{class_name}/fleet-sets/qualifying",
    response_model=FleetSetRead,
)
def create_quali_set(
    regatta_id: int,
    class_name: str,
    body: CreateQualifyingSetIn,
    db: Session = Depends(get_db),
):
    fs = create_initial_set_random(
        db, regatta_id, class_name, body.label, body.num_fleets
    )
    db.commit()
    db.refresh(fs)

    if body.race_ids:
        _validate_races_same_regatta_and_class(db, regatta_id, class_name, body.race_ids)
        _attach_races_to_set(db, body.race_ids, fs.id)

    db.refresh(fs)
    return fs


@router.post(
    "/{regatta_id}/classes/{class_name}/fleet-sets/reshuffle",
    response_model=FleetSetRead,
)
def reshuffle(
    regatta_id: int,
    class_name: str,
    body: ReshuffleIn,
    db: Session = Depends(get_db),
):
    prev = (
        db.query(FleetSet)
        .filter(FleetSet.regatta_id == regatta_id, FleetSet.class_name == class_name)
        .order_by(FleetSet.created_at.desc(), FleetSet.id.desc())
        .first()
    )
    if not prev:
        raise HTTPException(
            status_code=400,
            detail="Não existe Fleet Set anterior para fazer reshuffle.",
        )

    try:
        fs = reshuffle_from_ranking(
            db, regatta_id, class_name, prev.id, body.label, body.num_fleets
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    db.refresh(fs)

    if body.race_ids:
        _validate_races_same_regatta_and_class(db, regatta_id, class_name, body.race_ids)
        _attach_races_to_set(db, body.race_ids, fs.id)

    db.refresh(fs)
    return fs


@router.post(
    "/{regatta_id}/classes/{class_name}/fleet-sets/finals",
    response_model=FleetSetRead,
)
def start_finals_set(
    regatta_id: int,
    class_name: str,
    body: StartFinalsIn,
    db: Session = Depends(get_db),
):
    fs = start_finals(db, regatta_id, class_name, body.label or "Finals", body.grouping)
    db.commit()
    db.refresh(fs)

    if body.race_ids:
        _validate_races_same_regatta_and_class(db, regatta_id, class_name, body.race_ids)
        _attach_races_to_set(db, body.race_ids, fs.id)

    db.refresh(fs)
    return fs


# -------------------------
# Listagem
# -------------------------
@router.get(
    "/{regatta_id}/classes/{class_name}/fleet-sets",
    response_model=List[FleetSetRead],
)
def list_sets(
    regatta_id: int,
    class_name: str,
    phase: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(FleetSet).filter(
        FleetSet.regatta_id == regatta_id,
        FleetSet.class_name == class_name,
    )
    if phase:
        q = q.filter(FleetSet.phase == phase)
    return q.order_by(FleetSet.created_at.asc()).all()


@router.get("/{regatta_id}/classes/{class_name}/fleet-sets/{set_id}/assignments")
def list_assignments(
    regatta_id: int,
    class_name: str,
    set_id: int,
    db: Session = Depends(get_db),
):
    fs = (
        db.query(FleetSet)
        .filter_by(id=set_id, regatta_id=regatta_id, class_name=class_name)
        .first()
    )
    if not fs:
        raise HTTPException(status_code=404, detail="Fleet set não encontrado")

    rows = (
        db.query(FleetAssignment.entry_id, FleetAssignment.fleet_id)
        .filter(FleetAssignment.fleet_set_id == set_id)
        .all()
    )
    return {
        "fleet_set_id": set_id,
        "assignments": [{"entry_id": e, "fleet_id": f} for (e, f) in rows],
    }


# -------------------------
# Delete
# -------------------------
@router.delete("/{regatta_id}/classes/{class_name}/fleet-sets/{set_id}")
def delete_fleet_set(
    regatta_id: int,
    class_name: str,
    set_id: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
):
    fs = (
        db.query(FleetSet)
        .filter(
            FleetSet.id == set_id,
            FleetSet.regatta_id == regatta_id,
            FleetSet.class_name == class_name,
        )
        .first()
    )
    if not fs:
        raise HTTPException(status_code=404, detail="Fleet set não encontrado")

    stats = _fleet_set_stats(db, set_id)
    race_count = stats["race_count"]
    result_count = stats["result_count"]

    if result_count > 0 and not force:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "There are results scored for races linked to this fleet set.",
                "code": "FLEETSET_HAS_RESULTS",
                "race_count": race_count,
                "result_count": result_count,
            },
        )

    if race_count > 0:
        (
            db.query(Race)
            .filter(Race.fleet_set_id == set_id)
            .update({"fleet_set_id": None}, synchronize_session=False)
        )

    db.query(FleetAssignment).filter(
        FleetAssignment.fleet_set_id == set_id
    ).delete(synchronize_session=False)

    db.query(Fleet).filter(Fleet.fleet_set_id == set_id).delete(
        synchronize_session=False
    )

    db.delete(fs)
    db.commit()

    return {
        "ok": True,
        "deleted_set_id": set_id,
        "race_count": race_count,
        "result_count": result_count,
    }


# -------------------------
# Update races of set
# -------------------------
class FleetSetRacesUpdate(BaseModel):
    race_ids: List[int]


@router.put(
    "/{regatta_id}/classes/{class_name}/fleet-sets/{set_id}/races",
    response_model=FleetSetRead,
)
def update_fleet_set_races(
    regatta_id: int,
    class_name: str,
    set_id: int,
    body: FleetSetRacesUpdate,
    force: bool = Query(False),
    db: Session = Depends(get_db),
):
    fs = (
        db.query(FleetSet)
        .filter(
            FleetSet.id == set_id,
            FleetSet.regatta_id == regatta_id,
            FleetSet.class_name == class_name,
        )
        .first()
    )
    if not fs:
        raise HTTPException(status_code=404, detail="Fleet set não encontrado")

    _validate_races_same_regatta_and_class(db, regatta_id, class_name, body.race_ids)

    current_races = db.query(Race.id).filter(Race.fleet_set_id == set_id).all()
    current_ids = [r.id for r in current_races]
    new_ids = body.race_ids or []

    removed_ids = [rid for rid in current_ids if rid not in new_ids]

    if removed_ids and not force:
        result_count = (
            db.query(func.count(Result.id))
            .filter(Result.race_id.in_(removed_ids))
            .scalar()
            or 0
        )
        if result_count > 0:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "There are results scored for races you are removing from this fleet set.",
                    "code": "RACES_WITH_RESULTS",
                    "race_count": len(removed_ids),
                    "result_count": int(result_count),
                },
            )

    (
        db.query(Race)
        .filter(Race.fleet_set_id == set_id)
        .update({"fleet_set_id": None}, synchronize_session=False)
    )

    if new_ids:
        (
            db.query(Race)
            .filter(Race.id.in_(new_ids))
            .update({"fleet_set_id": set_id}, synchronize_session=False)
        )

    db.commit()
    db.refresh(fs)
    return fs


# -------------------------
# 🚀 Publish / Unpublish / Public list
# -------------------------
@router.post("/{regatta_id}/classes/{class_name}/fleet-sets/{set_id}/publish")
def publish_set(regatta_id: int, class_name: str, set_id: int, db: Session = Depends(get_db)):
    fs = (
        db.query(FleetSet)
        .filter(FleetSet.id == set_id, FleetSet.regatta_id == regatta_id, FleetSet.class_name == class_name)
        .first()
    )

    if not fs:
        raise HTTPException(status_code=404, detail="Fleet set não encontrado")

    fs.is_published = True
    if not fs.public_title:
        fs.public_title = fs.label
    fs.published_at = sa.func.now()

    db.commit()
    db.refresh(fs)
    return {"ok": True, "fleet_set_id": set_id}


@router.post("/{regatta_id}/classes/{class_name}/fleet-sets/{set_id}/unpublish")
def unpublish_set(regatta_id: int, class_name: str, set_id: int, db: Session = Depends(get_db)):
    fs = (
        db.query(FleetSet)
        .filter(FleetSet.id == set_id, FleetSet.regatta_id == regatta_id, FleetSet.class_name == class_name)
        .first()
    )

    if not fs:
        raise HTTPException(status_code=404, detail="Fleet set não encontrado")

    fs.is_published = False
    fs.published_at = None

    db.commit()
    db.refresh(fs)
    return {"ok": True, "fleet_set_id": set_id}


@router.get("/{regatta_id}/published-fleet-sets", response_model=List[FleetSetRead])
def list_published(regatta_id: int, db: Session = Depends(get_db)):
    return (
        db.query(FleetSet)
        .filter(FleetSet.regatta_id == regatta_id, FleetSet.is_published == True)
        .order_by(FleetSet.created_at.asc())
        .all()
    )
# -------------------------
# Update FleetSet fields (ex: public_title)
# -------------------------
class FleetSetUpdate(BaseModel):
    public_title: Optional[str] = None


@router.patch(
    "/{regatta_id}/classes/{class_name}/fleet-sets/{set_id}",
    response_model=FleetSetRead,
)
def update_fleet_set(
    regatta_id: int,
    class_name: str,
    set_id: int,
    body: FleetSetUpdate,
    db: Session = Depends(get_db),
):
    fs = (
        db.query(FleetSet)
        .filter(
            FleetSet.id == set_id,
            FleetSet.regatta_id == regatta_id,
            FleetSet.class_name == class_name,
        )
        .first()
    )

    if not fs:
        raise HTTPException(status_code=404, detail="Fleet set não encontrado")

    # Atualizar apenas public_title (podes facilmente expandir isto no futuro)
    if body.public_title is not None:
        fs.public_title = body.public_title

    db.commit()
    db.refresh(fs)
    return fs


@router.post("/regattas/{regatta_id}/medal_race/assign")
def assign_medal_race_entries(
    regatta_id: int,
    data: MedalRaceAssignSchema,
    db: Session = Depends(get_db)
):
    # criar "fleet medal"
    fleet = Fleet(
        regatta_id=regatta_id,
        name="Medal",
        color="Medal",
        phase="medal"
    )
    db.add(fleet)
    db.commit()
    db.refresh(fleet)

    # assignments
    for entry_id in data.entries:
        a = Assignment(
            regatta_id=regatta_id,
            fleet_id=fleet.id,
            entry_id=entry_id
        )
        db.add(a)

    db.commit()
    return {"status": "ok", "fleet_id": fleet.id}
