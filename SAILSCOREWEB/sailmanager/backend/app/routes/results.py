# app/routes/results.py
from fastapi import APIRouter

from app.routes import results_basic
from app.routes import results_race
from app.routes import results_item
from app.routes import results_overall
from app.routes import results_codes  # ✅ novo

router = APIRouter()

router.include_router(results_basic.router)
router.include_router(results_race.router)
router.include_router(results_item.router)
router.include_router(results_overall.router)
router.include_router(results_codes.router)  # ✅ novo
