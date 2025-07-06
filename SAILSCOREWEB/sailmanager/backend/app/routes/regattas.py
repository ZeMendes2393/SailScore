from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models
from app.schemas import RegattaCreate

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/")
def list_regattas(db: Session = Depends(get_db)):
    return db.query(models.Regatta).all()

@router.post("/")
def create_regatta(regatta: RegattaCreate, db: Session = Depends(get_db)):
    new_regatta = models.Regatta(**regatta.dict())
    db.add(new_regatta)
    db.commit()
    db.refresh(new_regatta)
    return {"message": "Regata criada com sucesso", "id": new_regatta.id}

# 🔍 Endpoint para buscar uma regata pelo ID
@router.get("/{regatta_id}")
def get_regatta(regatta_id: int, db: Session = Depends(get_db)):
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    return regatta
