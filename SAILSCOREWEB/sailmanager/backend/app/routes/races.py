from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas

router = APIRouter()

@router.post("/", response_model=schemas.RaceRead)
def create_race(race: schemas.RaceCreate, db: Session = Depends(get_db)):
    # valida regata
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")

    # constrói nome único por classe (ex.: "R1 (49er)")
    base_name = (race.name or "").strip()
    class_tag = (race.class_name or "").strip()
    if not base_name:
        raise HTTPException(status_code=400, detail="Race name is required")
    if not class_tag:
        raise HTTPException(status_code=400, detail="class_name is required")

    stored_name = base_name if class_tag in base_name else f"{base_name} ({class_tag})"

    # evita duplicados dentro da mesma regata
    exists = db.query(models.Race).filter(
        models.Race.regatta_id == race.regatta_id,
        models.Race.name == stored_name,
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Já existe uma corrida com esse nome nessa classe.")

    # cria corrida
    new_race = models.Race(
        regatta_id=race.regatta_id,
        name=stored_name,
        date=race.date,
        class_name=class_tag,
    )
    db.add(new_race)
    db.commit()
    db.refresh(new_race)
    return new_race


@router.get("/by_regatta/{regatta_id}", response_model=List[schemas.RaceRead])
def get_races_by_regatta(regatta_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Race)
        .filter_by(regatta_id=regatta_id)
        .order_by(models.Race.id.asc())
        .all()
    )
