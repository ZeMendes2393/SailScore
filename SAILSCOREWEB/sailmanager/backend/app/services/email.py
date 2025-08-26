# app/services/email.py
import os
import smtplib
from email.message import EmailMessage
from typing import Optional

# 🔑 carrega o .env mesmo que este módulo seja importado cedo
from dotenv import load_dotenv
load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASS = os.getenv("SMTP_PASS", "").strip()

SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "no-reply@mail.sailscore.app").strip()
SMTP_FROM_NAME  = os.getenv("SMTP_FROM_NAME", os.getenv("DEFAULT_CLUB_NAME", "SailScore")).strip()
DEFAULT_REPLY_TO = os.getenv("DEFAULT_CLUB_REPLY_TO", "").strip()

def _compose_from(from_email: Optional[str], from_name: Optional[str]) -> str:
    email = (from_email or SMTP_FROM_EMAIL).strip()
    name  = (from_name  or SMTP_FROM_NAME).strip()
    return f'{name} <{email}>' if name else email

def send_email(
    to: str,
    subject: str,
    html: Optional[str] = None,
    text: Optional[str] = None,
    *,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> None:
    msg = EmailMessage()
    msg["To"] = to
    msg["Subject"] = subject
    msg["From"] = _compose_from(from_email, from_name)
    if reply_to or DEFAULT_REPLY_TO:
        msg["Reply-To"] = (reply_to or DEFAULT_REPLY_TO)

    if text:
        msg.set_content(text)
    if html:
        if text:
            msg.add_alternative(html, subtype="html")
        else:
            msg.set_content(html, subtype="html")

    # 🔎 debug rápido
    print(f"[EMAIL DEBUG] SMTP_HOST={SMTP_HOST or '(vazio)'} USER={(SMTP_USER[:4] + '****') if SMTP_USER else '(vazio)'} PORT={SMTP_PORT}")

    if not SMTP_HOST:
        print("\n[EMAIL LOG]")
        print("To:", to)
        print("Subject:", subject)
        print("From:", msg["From"])
        if msg.get("Reply-To"):
            print("Reply-To:", msg["Reply-To"])
        if text:
            print("Text:\n", text)
        if html:
            print("HTML:\n", html)
        print("[/EMAIL LOG]\n")
        return

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
            s.ehlo()
            try:
                s.starttls()
                s.ehlo()
            except Exception:
                pass
            if SMTP_USER and SMTP_PASS:
                s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        print(f"[EMAIL SMTP] Sent to {to}")
    except Exception as e:
        print(f"[EMAIL ERROR] {e}. Falling back to LOG.")
        print("\n[EMAIL LOG Fallback]")
        print("To:", to)
        print("Subject:", subject)
        print("From:", msg["From"])
        if msg.get("Reply-To"):
            print("Reply-To:", msg["Reply-To"])
        if text:
            print("Text:\n", text)
        if html:
            print("HTML:\n", html)
        print("[/EMAIL LOG]\n")
