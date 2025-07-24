from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from typing import List

router = APIRouter()

@router.post("/", response_model=schemas.RaceRead)
def create_race(race: schemas.RaceCreate, db: Session = Depends(get_db)):
    regatta = db.query(models.Regatta).filter_by(id=race.regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")

    new_race = models.Race(
        regatta_id=race.regatta_id,
        name=race.name,
        date=race.date
    )
    db.add(new_race)
    db.commit()
    db.refresh(new_race)
    return new_race

@router.get("/by_regatta/{regatta_id}", response_model=List[schemas.RaceRead])
def get_races_by_regatta(regatta_id: int, db: Session = Depends(get_db)):
    return db.query(models.Race).filter_by(regatta_id=regatta_id).all()
