from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas
from app.database import get_db

router = APIRouter()

@router.get("/", response_model=List[schemas.RegattaRead])
def list_regattas(db: Session = Depends(get_db)):
    return db.query(models.Regatta).all()

@router.post("/", response_model=schemas.RegattaRead)
def create_regatta(regatta: schemas.RegattaCreate, db: Session = Depends(get_db)):
    new_regatta = models.Regatta(**regatta.dict())
    db.add(new_regatta)
    db.commit()
    db.refresh(new_regatta)
    return new_regatta

@router.get("/{regatta_id}", response_model=schemas.RegattaRead)
def get_regatta(regatta_id: int, db: Session = Depends(get_db)):
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regata não encontrada")
    return regatta


@router.get("/{regatta_id}/classes", response_model=List[str])
def get_classes_for_regatta(regatta_id: int, db: Session = Depends(get_db)):
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regata não encontrada")
    
    return [rc.class_name for rc in regatta.classes]

