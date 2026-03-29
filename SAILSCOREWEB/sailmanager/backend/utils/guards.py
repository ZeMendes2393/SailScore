from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.org_scope import assert_user_can_manage_org_id
from app.jury_scope import assert_jury_regatta_access
from app.database import get_db
from utils.auth_utils import get_current_user, get_current_regatta_id


def ensure_regatta_scope(
    regatta_id: int,
    current_user: models.User = Depends(get_current_user),
    current_regatta_id: int | None = Depends(get_current_regatta_id),
    db: Session = Depends(get_db),
):
    """
    - Admin/platform_admin: assert org scope (regatta deve pertencer à org do user).
    - Jury: perfil de júri + organização da regata.
    - Regatista: o regatta_id da rota TEM de coincidir com o regatta_id do token.
    """
    if current_user.role in ("admin", "platform_admin"):
        regatta = db.query(models.Regatta).filter_by(id=regatta_id).first()
        if not regatta:
            raise HTTPException(status_code=404, detail="Regatta not found")
        assert_user_can_manage_org_id(current_user, regatta.organization_id)
        return
    if current_user.role == "jury":
        assert_jury_regatta_access(db, current_user, regatta_id)
        return
    if current_regatta_id is None or int(regatta_id) != int(current_regatta_id):
        raise HTTPException(status_code=403, detail="Fora do âmbito da tua regata")
    regatta = db.query(models.Regatta).filter_by(id=regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    if int(regatta.organization_id) != int(current_user.organization_id):
        raise HTTPException(
            status_code=403,
            detail="Sem permissão nesta regata (organização).",
        )
