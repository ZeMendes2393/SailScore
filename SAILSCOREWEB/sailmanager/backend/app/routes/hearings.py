from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from utils.auth_utils import verify_role

router = APIRouter(prefix="/hearings", tags=["hearings"])

# Helpers simples para “legendar” lados do protesto sem dependência forte do modelo
def _race_of(p) -> str:
    if not p: return "—"
    for k in ("race", "race_number", "heat"):
        v = getattr(p, k, None)
        if v is not None:
            return str(v)
    return "—"

def _human_side(p, side: str) -> str:
    if not p: return "—"
    # tenta alguns campos comuns (adapta se os teus nomes forem diferentes)
    for k in (f"{side}_label", f"{side}_boat", f"{side}_sail", f"{side}_name", side):
        v = getattr(p, k, None)
        if v:
            base = str(v)
            cls = getattr(p, f"{side}_class", None)
            return f"{base} · {cls}" if cls else base
    return "—"

@router.get("/{regatta_id}", response_model=List[schemas.HearingOut])
def list_hearings(regatta_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(models.Hearing)
        .filter(models.Hearing.regatta_id == regatta_id)
        .order_by(models.Hearing.case_number.asc())
        .all()
    )
    out: List[schemas.HearingOut] = []
    for h in rows:
        # tenta carregar o protesto; se não existir modelo, devolve “—”
        protest = None
        Protest = getattr(models, "Protest", None)
        if Protest is not None:
            protest = db.query(Protest).filter(Protest.id == h.protest_id).first()
        out.append(schemas.HearingOut(
            id=h.id,
            case_number=h.case_number,
            race=_race_of(protest),
            initiator=_human_side(protest, "initiator"),
            respondent=_human_side(protest, "respondent"),
            decision=h.decision,
            sch_date=h.sch_date,
            sch_time=h.sch_time,
            room=h.room,
            status=h.status,  # type: ignore
        ))
    return out

@router.post("/for-protest/{protest_id}", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_role(["admin"]))])
def create_hearing_for_protest(protest_id: int, db: Session = Depends(get_db)):
    Protest = getattr(models, "Protest", None)
    if Protest is None:
        raise HTTPException(status_code=400, detail="Modelo Protest não disponível.")
    p = db.query(Protest).filter(Protest.id == protest_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Protesto não encontrado")

    regatta_id = getattr(p, "regatta_id", None)
    if not regatta_id:
        raise HTTPException(status_code=400, detail="Protesto sem regatta_id")

    # próximo nº de caso por regata
    last = (
        db.query(models.Hearing.case_number)
        .filter(models.Hearing.regatta_id == regatta_id)
        .order_by(models.Hearing.case_number.desc())
        .first()
    )
    next_case = (last[0] if last and last[0] else 0) + 1

    h = models.Hearing(
        regatta_id=int(regatta_id),
        protest_id=int(protest_id),
        case_number=next_case,
        status="SCHEDULED",
    )
    db.add(h); db.commit(); db.refresh(h)
    return {"id": h.id, "case_number": h.case_number}

@router.patch("/{hearing_id}", dependencies=[Depends(verify_role(["admin"]))])
def update_hearing(hearing_id: int, payload: schemas.HearingPatch, db: Session = Depends(get_db)):
    h = db.query(models.Hearing).filter(models.Hearing.id == hearing_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hearing não encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(h, k, v)
    db.add(h); db.commit(); db.refresh(h)
    return {"ok": True}

@router.delete("/{hearing_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_role(["admin"]))])
def delete_hearing(hearing_id: int, db: Session = Depends(get_db)):
    h = db.query(models.Hearing).filter(models.Hearing.id == hearing_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hearing não encontrado")
    db.delete(h); db.commit()
    return
