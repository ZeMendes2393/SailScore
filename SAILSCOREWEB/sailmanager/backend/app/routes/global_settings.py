# app/routes/global_settings.py — org-scoped payment/config variables (club name, IBAN, etc.)
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.org_scope import assert_user_can_manage_organization, resolve_org
from utils.auth_utils import get_current_user

router = APIRouter(prefix="/settings", tags=["global-settings"])

KNOWN_KEYS = frozenset({"club_name", "entry_fee_transfer_iban", "contact_email", "contact_phone"})


def _get_value(db: Session, key: str, organization_id: int) -> str | None:
    row = (
        db.query(models.GlobalSetting)
        .filter(models.GlobalSetting.organization_id == organization_id, models.GlobalSetting.key == key)
        .first()
    )
    return row.value if row else None


def _set_value(db: Session, key: str, value: str | None, organization_id: int) -> None:
    row = (
        db.query(models.GlobalSetting)
        .filter(models.GlobalSetting.organization_id == organization_id, models.GlobalSetting.key == key)
        .first()
    )
    if row is None:
        row = models.GlobalSetting(organization_id=organization_id, key=key, value=value)
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
def get_global_settings(
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
):
    """Return org settings. Used by admin UI and backend (e.g. email templates)."""
    organization = resolve_org(db, org_slug=org)
    return GlobalSettingsOut(
        club_name=_get_value(db, "club_name", organization.id),
        entry_fee_transfer_iban=_get_value(db, "entry_fee_transfer_iban", organization.id),
        contact_email=_get_value(db, "contact_email", organization.id),
        contact_phone=_get_value(db, "contact_phone", organization.id),
    )


@router.patch("/global", response_model=GlobalSettingsOut)
def update_global_settings(
    body: GlobalSettingsUpdate,
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update org settings. Admin only."""
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    organization = resolve_org(db, org_slug=org)
    assert_user_can_manage_organization(current_user, organization)

    if body.club_name is not None:
        _set_value(db, "club_name", body.club_name.strip() or None, organization.id)
    if body.entry_fee_transfer_iban is not None:
        _set_value(db, "entry_fee_transfer_iban", body.entry_fee_transfer_iban.strip() or None, organization.id)
    if body.contact_email is not None:
        _set_value(db, "contact_email", body.contact_email.strip() or None, organization.id)
    if body.contact_phone is not None:
        _set_value(db, "contact_phone", body.contact_phone.strip() or None, organization.id)

    return GlobalSettingsOut(
        club_name=_get_value(db, "club_name", organization.id),
        entry_fee_transfer_iban=_get_value(db, "entry_fee_transfer_iban", organization.id),
        contact_email=_get_value(db, "contact_email", organization.id),
        contact_phone=_get_value(db, "contact_phone", organization.id),
    )


# ---------- Entry application received email (Online Entry config) ----------
# When the database is empty, these defaults are used. Short placeholders: {{event}}, {{iban}}, {{contact}}, {{club}}, {{sailor}}, {{helm}}, {{class}}, {{boat}}, {{sail}}.
DEFAULT_ENTRY_EMAIL_SUBJECT = "Entry application received – {{event}}"
DEFAULT_ENTRY_EMAIL_PAYMENT = """To proceed with payment, please use the following IBAN:

{{iban}}

Please include your name and sail number in the payment reference."""
DEFAULT_ENTRY_EMAIL_CLOSING = "If you have any questions, please contact us at {{contact}}."


def _get_bool(db: Session, key: str, organization_id: int, default: bool = True) -> bool:
    v = _get_value(db, key, organization_id)
    if v is None or v.strip() == "":
        return default
    return v.strip().lower() in ("1", "true", "yes")


def _set_bool(db: Session, key: str, value: bool, organization_id: int) -> None:
    _set_value(db, key, "1" if value else "0", organization_id)


class EntryEmailOut(BaseModel):
    """Subject is fixed by the system; only payment and closing are editable."""
    enabled: bool = True
    payment_instructions: str = ""
    closing_note: str = ""


class EntryEmailUpdate(BaseModel):
    enabled: bool | None = None
    payment_instructions: str | None = None
    closing_note: str | None = None


@router.get("/entry-email", response_model=EntryEmailOut)
def get_entry_email_config(
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
):
    """Return entry application received email config. Subject is fixed; only payment and closing are stored."""
    organization = resolve_org(db, org_slug=org)
    pay = _get_value(db, "entry_email_payment_instructions", organization.id)
    close = _get_value(db, "entry_email_closing_note", organization.id)
    return EntryEmailOut(
        enabled=_get_bool(db, "entry_email_enabled", organization.id, True),
        payment_instructions=pay.strip() if pay and pay.strip() else DEFAULT_ENTRY_EMAIL_PAYMENT,
        closing_note=close.strip() if close and close.strip() else DEFAULT_ENTRY_EMAIL_CLOSING,
    )


@router.patch("/entry-email", response_model=EntryEmailOut)
def update_entry_email_config(
    body: EntryEmailUpdate,
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update entry application received email config. Admin only."""
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    organization = resolve_org(db, org_slug=org)
    assert_user_can_manage_organization(current_user, organization)

    if body.enabled is not None:
        _set_bool(db, "entry_email_enabled", body.enabled, organization.id)
    if body.payment_instructions is not None:
        _set_value(db, "entry_email_payment_instructions", body.payment_instructions.strip() or None, organization.id)
    if body.closing_note is not None:
        _set_value(db, "entry_email_closing_note", body.closing_note.strip() or None, organization.id)

    return get_entry_email_config(org=org, db=db)


# ---------- Confirmed entry email (sent when entry is paid + confirmed) ----------
DEFAULT_CONFIRMED_ENTRY_SUBJECT = "Confirmed entry – {{event}}"
DEFAULT_CONFIRMED_ENTRY_MESSAGE = """Your entry has been accepted.

Payment has been received and your entry is now confirmed for the championship. You are officially registered for {{event}}.

Entry details:
- Event: {{event}}
- Class: {{class}}
- Boat: {{boat}}
- Sail number: {{sail}}
- Helm: {{helm}}

We look forward to seeing you at the event."""
DEFAULT_CONFIRMED_ENTRY_CLOSING = "If you have any questions, please contact us at {{contact}}."


class ConfirmedEntryEmailOut(BaseModel):
    """Subject is fixed; main message and closing note are editable. Account credentials are appended by the system when sending."""
    enabled: bool = True
    main_message: str = ""
    closing_note: str = ""


class ConfirmedEntryEmailUpdate(BaseModel):
    enabled: bool | None = None
    main_message: str | None = None
    closing_note: str | None = None


@router.get("/confirmed-entry-email", response_model=ConfirmedEntryEmailOut)
def get_confirmed_entry_email_config(
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
):
    """Return confirmed entry email config. Sent when an entry is marked paid and confirmed."""
    organization = resolve_org(db, org_slug=org)
    msg = _get_value(db, "confirmed_entry_email_main_message", organization.id)
    close = _get_value(db, "confirmed_entry_email_closing_note", organization.id)
    return ConfirmedEntryEmailOut(
        enabled=_get_bool(db, "confirmed_entry_email_enabled", organization.id, True),
        main_message=msg.strip() if msg and msg.strip() else DEFAULT_CONFIRMED_ENTRY_MESSAGE,
        closing_note=close.strip() if close and close.strip() else DEFAULT_CONFIRMED_ENTRY_CLOSING,
    )


@router.patch("/confirmed-entry-email", response_model=ConfirmedEntryEmailOut)
def update_confirmed_entry_email_config(
    body: ConfirmedEntryEmailUpdate,
    org: Optional[str] = Query(None, description="Slug da organização (default: sailscore)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update confirmed entry email config. Admin only."""
    if current_user.role not in ("admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    organization = resolve_org(db, org_slug=org)
    assert_user_can_manage_organization(current_user, organization)

    if body.enabled is not None:
        _set_bool(db, "confirmed_entry_email_enabled", body.enabled, organization.id)
    if body.main_message is not None:
        _set_value(db, "confirmed_entry_email_main_message", body.main_message.strip() or None, organization.id)
    if body.closing_note is not None:
        _set_value(db, "confirmed_entry_email_closing_note", body.closing_note.strip() or None, organization.id)

    return get_confirmed_entry_email_config(org=org, db=db)
