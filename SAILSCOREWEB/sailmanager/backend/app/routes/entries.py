from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models, schemas
from fastapi import Depends, HTTPException, status
from utils.auth_utils import get_current_user
from app import models  # assegura que tens esta importação

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/")
def create_entry(entry: schemas.EntryCreate, db: Session = Depends(get_db)):
    new_entry = models.Entry(
        # Boat data
        class_name=entry.class_name,
        boat_country=entry.boat_country,
        sail_number=entry.sail_number,
        boat_name=entry.boat_name,
        category=entry.category,

        # Helm data
        date_of_birth=entry.date_of_birth,
        gender=entry.gender,
        first_name=entry.first_name,
        last_name=entry.last_name,
        helm_country=entry.helm_country,
        territory=entry.territory,
        club=entry.club,
        email=entry.email,
        contact_phone_1=entry.contact_phone_1,
        contact_phone_2=entry.contact_phone_2,
        address=entry.address,
        zip_code=entry.zip_code,
        town=entry.town,
        helm_country_secondary=entry.helm_country_secondary,

        # Foreign keys
        regatta_id=entry.regatta_id,
        user_id=entry.user_id,
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return {"message": "Inscrição criada com sucesso", "id": new_entry.id}


@router.get("/by_regatta/{regatta_id}")
def get_entries_by_regatta(regatta_id: int, db: Session = Depends(get_db)):
    return db.query(models.Entry).filter(models.Entry.regatta_id == regatta_id).all()


@router.get("/{entry_id}", response_model=schemas.EntryRead)
def get_entry_by_id(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry



@router.patch("/{entry_id}/toggle_paid")
def toggle_paid(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)  # 👈 aqui está a mudança
):
    if current_user.role != "admin":  # 👈 usa ponto, não colchetes
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    
    entry.paid = not entry.paid
    db.commit()
    return {"id": entry.id, "paid": entry.paid}