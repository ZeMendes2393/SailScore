# app/services/fleets.py
import random
from sqlalchemy.orm import Session
from typing import List, Dict, Tuple
from app.models import FleetSet, Fleet, FleetAssignment, Race, Result, Entry

FLEET_COLORS_QUALI = {2:["Yellow","Blue"], 3:["Yellow","Blue","Red"], 4:["Yellow","Blue","Red","Green"]}

def list_confirmed_entries(db: Session, regatta_id: int, class_name: str) -> List[Entry]:
    return db.query(Entry).filter(
        Entry.regatta_id==regatta_id,
        Entry.class_name==class_name,
        Entry.paid==True,
        Entry.confirmed==True
    ).all()

def compute_overall_ranking(db: Session, regatta_id: int, class_name: str) -> List[int]:
    # ranking simples por soma de pontos (usa todas as races dessa classe)
    sub = db.query(Result.sail_number, Result.points).join(Race, Result.race_id==Race.id)\
        .filter(Race.regatta_id==regatta_id, Race.class_name==class_name).all()
    # agrega por sail_number
    agg = {}
    for sn, pts in sub:
        if sn is None or pts is None: continue
        agg.setdefault(sn, 0.0)
        agg[sn] += float(pts)
    # map sail_number -> entry_id
    sn_to_entry = dict(db.query(Entry.sail_number, Entry.id).filter(
        Entry.regatta_id==regatta_id, Entry.class_name==class_name
    ))
    ranked = [sn_to_entry[sn] for sn, _ in sorted(agg.items(), key=lambda x: x[1])]
    return ranked

def create_initial_set_random(db: Session, regatta_id: int, class_name: str, label: str|None, num_fleets: int) -> FleetSet:
    fs = FleetSet(regatta_id=regatta_id, class_name=class_name, phase="qualifying", label=label)
    db.add(fs); db.flush()
    names = FLEET_COLORS_QUALI[num_fleets]
    fleets = [Fleet(fleet_set_id=fs.id, name=n, order_index=i) for i,n in enumerate(names)]
    db.add_all(fleets); db.flush()
    entries = list_confirmed_entries(db, regatta_id, class_name)
    random.shuffle(entries)
    # round-robin
    for i, e in enumerate(entries):
        f = fleets[i % len(fleets)]
        db.add(FleetAssignment(fleet_set_id=fs.id, fleet_id=f.id, entry_id=e.id))
    return fs

def all_races_scored_for_set(db: Session, fleet_set_id: int) -> bool:
    race_ids = [r.id for r in db.query(Race.id).filter(Race.fleet_set_id==fleet_set_id)]
    if not race_ids: return True
    # considera "scored" se não há resultados com code/points nulos
    missing = db.query(Result.id).filter(Result.race_id.in_(race_ids), Result.points==None).first()
    return missing is None

def reshuffle_from_ranking(db: Session, regatta_id: int, class_name: str, prev_set_id: int, label: str|None, num_fleets: int) -> FleetSet:
    if not all_races_scored_for_set(db, prev_set_id):
        raise ValueError("Há regatas do set anterior por pontuar.")
    ranking = compute_overall_ranking(db, regatta_id, class_name)
    fs = FleetSet(regatta_id=regatta_id, class_name=class_name, phase="qualifying", label=label)
    db.add(fs); db.flush()
    names = FLEET_COLORS_QUALI[num_fleets]
    fleets = [Fleet(fleet_set_id=fs.id, name=n, order_index=i) for i,n in enumerate(names)]
    db.add_all(fleets); db.flush()
    # padrão simples: snake fill (A,B,A,B / A,B,C,A,B,C ...)
    for i, entry_id in enumerate(ranking):
        f = fleets[i % len(fleets)]
        db.add(FleetAssignment(fleet_set_id=fs.id, fleet_id=f.id, entry_id=entry_id))
    return fs

def start_finals(db: Session, regatta_id: int, class_name: str, label: str, grouping: Dict[str,int]) -> FleetSet:
    fs = FleetSet(regatta_id=regatta_id, class_name=class_name, phase="finals", label=label)
    db.add(fs); db.flush()
    fleets = []
    for i,(name,size) in enumerate(grouping.items()):
        fleets.append(Fleet(fleet_set_id=fs.id, name=name, order_index=i))
    db.add_all(fleets); db.flush()
    ranking = compute_overall_ranking(db, regatta_id, class_name)
    idx = 0
    for f in fleets:
        size = next(v for k,v in grouping.items() if k==f.name)
        for entry_id in ranking[idx:idx+size]:
            db.add(FleetAssignment(fleet_set_id=fs.id, fleet_id=f.id, entry_id=entry_id))
        idx += size
    return fs
