from fastapi import Depends, HTTPException
from app import models
from utils.auth_utils import get_current_user, get_current_regatta_id

def ensure_regatta_scope(
    regatta_id: int,
    current_user: models.User = Depends(get_current_user),
    current_regatta_id: int | None = Depends(get_current_regatta_id),
):
    """
    - Admin: passa sempre.
    - Regatista: o regatta_id da rota TEM de coincidir com o regatta_id do token.
    """
    if current_user.role == "admin":
        return
    if current_regatta_id is None or int(regatta_id) != int(current_regatta_id):
        raise HTTPException(status_code=403, detail="Fora do âmbito da tua regata")
