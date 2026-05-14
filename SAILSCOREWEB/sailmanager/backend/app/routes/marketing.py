"""Public marketing site requests (e.g. demo booking)."""
from __future__ import annotations

import html
import logging
import os
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.email import enqueue_email_send
from utils.auth_utils import get_current_user

router = APIRouter(prefix="/marketing", tags=["marketing"])
logger = logging.getLogger("sailscore")

_WS = re.compile(r"\s+")


def _notify_email() -> str:
    return (
        os.getenv("DEMO_REQUEST_NOTIFY_EMAIL", "").strip()
        or os.getenv("DEFAULT_CLUB_REPLY_TO", "").strip()
    )


class DemoRequestIn(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    club_name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=40)
    message: Optional[str] = Field(None, max_length=2000)
    # Honeypot: must stay empty; bots often fill it.
    company: Optional[str] = Field(None, max_length=200)

    @field_validator("full_name", "club_name", mode="before")
    @classmethod
    def strip_required(cls, v: object) -> object:
        if isinstance(v, str):
            return _WS.sub(" ", v).strip()
        return v

    @field_validator("phone", "message", "company", mode="before")
    @classmethod
    def strip_optional(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return v


@router.post("/demo-request")
def submit_demo_request(body: DemoRequestIn, db: Session = Depends(get_db)) -> dict:
    if body.company:
        return {"ok": True, "emailed": False}

    row = models.MarketingDemoRequest(
        full_name=body.full_name,
        email=str(body.email),
        club_name=body.club_name,
        phone=body.phone,
        message=body.message,
        notification_email_sent=False,
    )
    db.add(row)
    db.flush()

    dest = _notify_email()
    safe_name = html.escape(body.full_name)
    safe_email = html.escape(str(body.email))
    safe_club = html.escape(body.club_name)
    safe_phone = html.escape(body.phone) if body.phone else "—"
    safe_msg = html.escape(body.message) if body.message else "—"

    text = (
        f"New SailScore demo request\n\n"
        f"Name: {body.full_name}\n"
        f"Email: {body.email}\n"
        f"Club / organization: {body.club_name}\n"
        f"Phone: {body.phone or '—'}\n\n"
        f"Message:\n{body.message or '—'}\n"
    )
    html_body = (
        f"<p><strong>Demo request</strong> (SailScore landing)</p>"
        f"<table style='border-collapse:collapse'>"
        f"<tr><td style='padding:4px 12px 4px 0'><b>Name</b></td><td>{safe_name}</td></tr>"
        f"<tr><td style='padding:4px 12px 4px 0'><b>Email</b></td><td>{safe_email}</td></tr>"
        f"<tr><td style='padding:4px 12px 4px 0'><b>Club</b></td><td>{safe_club}</td></tr>"
        f"<tr><td style='padding:4px 12px 4px 0'><b>Phone</b></td><td>{safe_phone}</td></tr>"
        f"</table>"
        f"<p><b>Message</b></p><p style='white-space:pre-wrap'>{safe_msg}</p>"
    )

    emailed = False
    if dest:
        subject = f"[SailScore] Demo: {body.club_name[:80]} ({body.full_name[:40]})"
        try:
            enqueue_email_send(
                dest,
                subject,
                html=html_body,
                text=text,
                reply_to=str(body.email),
            )
            emailed = True
            row.notification_email_sent = True
        except Exception:
            logger.exception("enqueue demo-request email failed (row still saved)")
    else:
        logger.info(
            "demo-request (no DEMO_REQUEST_NOTIFY_EMAIL): id=%s club=%r email=%r name=%r",
            row.id,
            body.club_name,
            body.email,
            body.full_name,
        )

    try:
        db.commit()
    except Exception:
        logger.exception("commit marketing_demo_request failed")
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Could not save the request right now. Please try again later.",
        )

    return {"ok": True, "emailed": emailed, "id": row.id}


@router.get("/demo-requests", response_model=List[schemas.MarketingDemoRequestRead])
def list_demo_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    if current_user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Platform administrator only.")
    return (
        db.query(models.MarketingDemoRequest)
        .order_by(models.MarketingDemoRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
