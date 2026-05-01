"""Admin: revenue / expense lines per regatta (internal championship finances)."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.org_scope import assert_user_can_manage_org_id
from utils.auth_utils import verify_role

router = APIRouter(prefix="/regattas", tags=["regatta-finances"])


def _get_regatta(db: Session, regatta_id: int) -> models.Regatta:
    r = db.query(models.Regatta).filter(models.Regatta.id == regatta_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Regatta not found")
    return r


def _line_or_404(db: Session, regatta_id: int, line_id: int) -> models.RegattaFinanceLine:
    row = (
        db.query(models.RegattaFinanceLine)
        .filter(
            models.RegattaFinanceLine.id == line_id,
            models.RegattaFinanceLine.regatta_id == regatta_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Finance line not found")
    return row


@router.get("/{regatta_id}/finance-lines", response_model=List[schemas.RegattaFinanceLineRead])
def list_finance_lines(
    regatta_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    regatta = _get_regatta(db, regatta_id)
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    rows = (
        db.query(models.RegattaFinanceLine)
        .filter(models.RegattaFinanceLine.regatta_id == regatta_id)
        .order_by(models.RegattaFinanceLine.sort_order.asc(), models.RegattaFinanceLine.id.asc())
        .all()
    )
    return rows


@router.post(
    "/{regatta_id}/finance-lines",
    response_model=schemas.RegattaFinanceLineRead,
    status_code=status.HTTP_201_CREATED,
)
def create_finance_line(
    regatta_id: int,
    body: schemas.RegattaFinanceLineCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    regatta = _get_regatta(db, regatta_id)
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    row = models.RegattaFinanceLine(
        regatta_id=regatta_id,
        kind=body.kind,
        description=body.description.strip(),
        amount=float(body.amount),
        currency=(body.currency or "EUR").strip().upper(),
        notes=(body.notes.strip() if body.notes else None),
        sort_order=body.sort_order,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{regatta_id}/finance-lines/{line_id}", response_model=schemas.RegattaFinanceLineRead)
def update_finance_line(
    regatta_id: int,
    line_id: int,
    body: schemas.RegattaFinanceLineUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    regatta = _get_regatta(db, regatta_id)
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    row = _line_or_404(db, regatta_id, line_id)
    data = body.model_dump(exclude_unset=True)
    if "description" in data and data["description"] is not None:
        data["description"] = str(data["description"]).strip()
    if "currency" in data and data["currency"] is not None:
        data["currency"] = str(data["currency"]).strip().upper()
    if "notes" in data:
        data["notes"] = data["notes"].strip() if data["notes"] else None
    if "amount" in data and data["amount"] is not None:
        data["amount"] = float(data["amount"])
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{regatta_id}/finance-lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_finance_line(
    regatta_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(verify_role(["admin"])),
):
    regatta = _get_regatta(db, regatta_id)
    assert_user_can_manage_org_id(current_user, regatta.organization_id)
    row = _line_or_404(db, regatta_id, line_id)
    db.delete(row)
    db.commit()
    return None
