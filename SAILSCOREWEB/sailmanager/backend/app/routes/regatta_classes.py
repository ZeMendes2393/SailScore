from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from app.org_scope import assert_user_can_manage_org_id
from utils.auth_utils import get_current_user
from typing import List

router = APIRouter(prefix="/regatta-classes")  # ✅ ESTE prefixo é essencial

@router.post("/", response_model=schemas.RegattaClassRead)
def add_class_to_regatta(
    class_data: schemas.RegattaClassCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    regatta = db.query(models.Regatta).filter_by(id=class_data.regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    new_class = models.RegattaClass(**class_data.dict())
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return new_class


@router.get("/by_regatta/{regatta_id}", response_model=List[schemas.RegattaClassRead])
def get_classes_for_regatta(regatta_id: int, db: Session = Depends(get_db)):
    return db.query(models.RegattaClass).filter_by(regatta_id=regatta_id).all()
