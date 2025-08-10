from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from typing import List

router = APIRouter(prefix="/regatta-classes")  # ✅ ESTE prefixo é essencial

@router.post("/", response_model=schemas.RegattaClassRead)
def add_class_to_regatta(class_data: schemas.RegattaClassCreate, db: Session = Depends(get_db)):
    new_class = models.RegattaClass(**class_data.dict())
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return new_class


@router.get("/by_regatta/{regatta_id}", response_model=List[schemas.RegattaClassRead])
def get_classes_for_regatta(regatta_id: int, db: Session = Depends(get_db)):
    return db.query(models.RegattaClass).filter_by(regatta_id=regatta_id).all()
