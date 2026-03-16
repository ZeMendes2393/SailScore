# app/routes/global_settings.py — global org/payment variables (club name, IBAN, etc.)
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from utils.auth_utils import get_current_user

router = APIRouter(prefix="/settings", tags=["global-settings"])

# Known keys for template variables; add more here as needed.
KNOWN_KEYS = frozenset({"club_name", "entry_fee_transfer_iban", "contact_email", "contact_phone"})


def _get_value(db: Session, key: str) -> str | None:
    row = db.query(models.GlobalSetting).filter(models.GlobalSetting.key == key).first()
    return row.value if row else None


def _set_value(db: Session, key: str, value: str | None) -> None:
    row = db.query(models.GlobalSetting).filter(models.GlobalSetting.key == key).first()
    if row is None:
        row = models.GlobalSetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()


class GlobalSettingsOut(BaseModel):
    """Response shape for GET; keys match template placeholder names."""
    club_name: str | None = None
    entry_fee_transfer_iban: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


class GlobalSettingsUpdate(BaseModel):
    """Body for PATCH; all fields optional."""
    club_name: str | None = None
    entry_fee_transfer_iban: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


@router.get("/global", response_model=GlobalSettingsOut)
def get_global_settings(db: Session = Depends(get_db)):
    """Return current global settings. Used by admin UI and by backend (e.g. email templates)."""
    return GlobalSettingsOut(
        club_name=_get_value(db, "club_name"),
        entry_fee_transfer_iban=_get_value(db, "entry_fee_transfer_iban"),
        contact_email=_get_value(db, "contact_email"),
        contact_phone=_get_value(db, "contact_phone"),
    )


@router.patch("/global", response_model=GlobalSettingsOut)
def update_global_settings(
    body: GlobalSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update global settings. Admin only."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    if body.club_name is not None:
        _set_value(db, "club_name", body.club_name.strip() or None)
    if body.entry_fee_transfer_iban is not None:
        _set_value(db, "entry_fee_transfer_iban", body.entry_fee_transfer_iban.strip() or None)
    if body.contact_email is not None:
        _set_value(db, "contact_email", body.contact_email.strip() or None)
    if body.contact_phone is not None:
        _set_value(db, "contact_phone", body.contact_phone.strip() or None)

    return GlobalSettingsOut(
        club_name=_get_value(db, "club_name"),
        entry_fee_transfer_iban=_get_value(db, "entry_fee_transfer_iban"),
        contact_email=_get_value(db, "contact_email"),
        contact_phone=_get_value(db, "contact_phone"),
    )


# ---------- Entry application received email (Online Entry config) ----------
DEFAULT_ENTRY_EMAIL_SUBJECT = "Entry application received – {{event_name}}"
DEFAULT_ENTRY_EMAIL_INTRO = "We are pleased to receive your entry for this event."
DEFAULT_ENTRY_EMAIL_PAYMENT = """To proceed with payment, please use the following IBAN:

{{entry_fee_transfer_iban}}

Please include your name and sail number in the payment reference."""
DEFAULT_ENTRY_EMAIL_CLOSING = "If you have any questions, please contact us at {{contact_email}}."


def _get_bool(db: Session, key: str, default: bool = True) -> bool:
    v = _get_value(db, key)
    if v is None or v.strip() == "":
        return default
    return v.strip().lower() in ("1", "true", "yes")


def _set_bool(db: Session, key: str, value: bool) -> None:
    _set_value(db, key, "1" if value else "0")


class EntryEmailOut(BaseModel):
    """Subject and custom intro are fixed by the system; only payment and closing are editable."""
    enabled: bool = True
    payment_instructions: str = ""
    closing_note: str = ""


class EntryEmailUpdate(BaseModel):
    enabled: bool | None = None
    payment_instructions: str | None = None
    closing_note: str | None = None


@router.get("/entry-email", response_model=EntryEmailOut)
def get_entry_email_config(db: Session = Depends(get_db)):
    """Return entry application received email config. Subject and intro are fixed; only payment and closing are stored."""
    pay = _get_value(db, "entry_email_payment_instructions")
    close = _get_value(db, "entry_email_closing_note")
    return EntryEmailOut(
        enabled=_get_bool(db, "entry_email_enabled", True),
        payment_instructions=pay.strip() if pay and pay.strip() else DEFAULT_ENTRY_EMAIL_PAYMENT,
        closing_note=close.strip() if close and close.strip() else DEFAULT_ENTRY_EMAIL_CLOSING,
    )


@router.patch("/entry-email", response_model=EntryEmailOut)
def update_entry_email_config(
    body: EntryEmailUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update entry application received email config. Admin only. Only enabled, payment_instructions and closing_note are editable."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    if body.enabled is not None:
        _set_bool(db, "entry_email_enabled", body.enabled)
    if body.payment_instructions is not None:
        _set_value(db, "entry_email_payment_instructions", body.payment_instructions.strip() or None)
    if body.closing_note is not None:
        _set_value(db, "entry_email_closing_note", body.closing_note.strip() or None)

    return get_entry_email_config(db)
