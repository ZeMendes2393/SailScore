"""Validação de acesso do perfil jury a uma regata (organização + RegattaJuryProfile)."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models


def assert_jury_regatta_access(db: Session, user: models.User, regatta_id: int) -> None:
    """Júri só acede à regata do seu perfil e da mesma organização."""
    if user.role != "jury":
        raise HTTPException(status_code=403, detail="Operação reservada a conta de júri.")
    regatta = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not regatta:
        raise HTTPException(status_code=404, detail="Regatta not found")
    if int(regatta.organization_id) != int(user.organization_id):
        raise HTTPException(
            status_code=403,
            detail="Sem permissão nesta regata (organização).",
        )
    prof = (
        db.query(models.RegattaJuryProfile)
        .filter(models.RegattaJuryProfile.user_id == user.id)
        .first()
    )
    if not prof or int(prof.regatta_id) != int(regatta_id):
        raise HTTPException(
            status_code=403,
            detail="Sem permissão nesta regata.",
        )
