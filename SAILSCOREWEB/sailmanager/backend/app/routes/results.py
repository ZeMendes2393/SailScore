from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models, schemas
from utils.auth_utils import get_current_user
from sqlalchemy import func
from fastapi import Query
router = APIRouter()

# Dependência para obter a sessão da BD
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 🔒 Criar resultado individual (apenas admin)
@router.post("/", response_model=schemas.ResultRead)
def create_result(
    result: schemas.ResultCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    regatta = db.query(models.Regatta).filter(models.Regatta.id == result.regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regata não encontrada")

    race = db.query(models.Race).filter(models.Race.id == result.race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    new_result = models.Result(
        regatta_id=result.regatta_id,
        race_id=result.race_id,
        sail_number=result.sail_number,
        boat_name=result.boat_name,
        class_name=result.boat_class,
        skipper_name=result.helm_name,
        position=result.position,
        points=result.points
    )
    db.add(new_result)
    db.commit()
    db.refresh(new_result)
    return new_result

# 📖 Ver resultados por regata
@router.get("/by_regatta/{regatta_id}", response_model=list[schemas.ResultRead])
def get_results_by_regatta(regatta_id: int, db: Session = Depends(get_db)):
    return db.query(models.Result).filter(models.Result.regatta_id == regatta_id).order_by(models.Result.position).all()

# 🧾 Criar múltiplos resultados para uma corrida
@router.post("/races/{race_id}/results", response_model=list[schemas.ResultRead])
def create_results_for_race(
    race_id: int,
    results: list[schemas.ResultCreate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    race = db.query(models.Race).filter_by(id=race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")

    created_results = []
    for r in results:
        result = models.Result(
            regatta_id=r.regatta_id,
            race_id=race_id,
            sail_number=r.sail_number,
            boat_name=r.boat_name,
            class_name=r.boat_class,
            skipper_name=r.helm_name,
            position=r.position,
            points=r.points
        )
        db.add(result)
        created_results.append(result)

    db.commit()
    return created_results

# 📊 Obter resultados por corrida
@router.get("/races/{race_id}/results", response_model=list[schemas.ResultRead])
def get_results_for_race(
    race_id: int,
    db: Session = Depends(get_db)
):
    return db.query(models.Result).filter_by(race_id=race_id).order_by(models.Result.position).all()



from fastapi import Path

@router.delete("/{result_id}", status_code=204)
def delete_result(
    result_id: int = Path(..., description="ID do resultado a remover"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    result = db.query(models.Result).filter_by(id=result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    db.delete(result)
    db.commit()
    return


@router.delete("/{result_id}", status_code=204)
def delete_result(
    result_id: int = Path(..., description="ID do resultado a remover"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    result = db.query(models.Result).filter_by(id=result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    db.delete(result)
    db.commit()
    return


@router.get("/overall/{regatta_id}")
def get_overall_results(
    regatta_id: int,
    db: Session = Depends(get_db),
):
    results = (
        db.query(
            models.Result.sail_number,
            models.Result.boat_name,
            models.Result.class_name,
            models.Result.skipper_name,
            func.sum(models.Result.points).label("total_points"),
        )
        .filter(models.Result.regatta_id == regatta_id)
        .group_by(
            models.Result.sail_number,
            models.Result.boat_name,
            models.Result.class_name,
            models.Result.skipper_name,
        )
        .order_by(func.sum(models.Result.points).asc())
        .all()
    )

    races = (
        db.query(models.Race.id, models.Race.name)
        .filter(models.Race.regatta_id == regatta_id)
        .order_by(models.Race.id)
        .all()
    )

    race_results = {}
    for race in races:
        race_results[race.id] = {
            "name": race.name,
            "results": {
                (r.sail_number, r.skipper_name): r.position
                for r in db.query(models.Result)
                .filter(models.Result.race_id == race.id)
                .all()
            }
        }

    overall = []
    for row in results:
        key = (row.sail_number, row.skipper_name)
        result_by_race = {
            race_results[rid]["name"]: race_results[rid]["results"].get(key, "-")
            for rid in race_results
        }

        overall.append({
            "sail_number": row.sail_number,
            "boat_name": row.boat_name,
            "class_name": row.class_name,
            "skipper_name": row.skipper_name,
            "total_points": row.total_points,
            "per_race": result_by_race,
        })

    return overall
