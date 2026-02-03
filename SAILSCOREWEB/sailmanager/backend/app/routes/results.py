# app/routes/results.py
from fastapi import APIRouter

from app.routes import results_basic
from app.routes import results_race
from app.routes import results_item
from app.routes import results_overall

router = APIRouter()

# mantém exatamente os mesmos paths (porque os filhos não têm prefix)
router.include_router(results_basic.router)
router.include_router(results_race.router)
router.include_router(results_item.router)
router.include_router(results_overall.router)
