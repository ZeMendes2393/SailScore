# app/routes/protests/__init__.py
from fastapi import APIRouter
from . import list as list_routes
from . import create as create_routes
from . import decision as decision_routes
from . import attachments as attachments_routes

# ✅ prefixo único aqui
router = APIRouter(prefix="/regattas/{regatta_id}/protests", tags=["Protests"])

# ✅ cada subrouter já vem sem prefixo
router.include_router(list_routes.router)
router.include_router(create_routes.router)
router.include_router(decision_routes.router)
router.include_router(attachments_routes.router)
