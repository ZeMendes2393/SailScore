from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from app import models, schemas
from app.database import get_db
from pydantic import BaseModel, Field
from utils.auth_utils import get_current_user

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



class ScoringPatch(BaseModel):
    discard_count: int = Field(ge=0)
    discard_threshold: int = Field(ge=0)
    code_points: Optional[Dict[str, float]] = None  # <- pontos por código (DNF/DNC)



@router.patch("/{regatta_id}/scoring", response_model=schemas.RegattaRead)
def update_scoring(
    regatta_id: int,
    body: ScoringPatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regata não encontrada")

    regatta.discard_count = body.discard_count
    regatta.discard_threshold = body.discard_threshold

    # 👇 ESTE BLOCO PRECISA MESMO DE ESTAR INDENTADO
    if body.code_points is not None:
        regatta.scoring_codes = {
            k.upper(): float(v) for k, v in body.code_points.items()
        }

    db.commit()
    db.refresh(regatta)
    return regatta