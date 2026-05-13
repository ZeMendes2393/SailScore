# app/services/email.py
import json
import os
import smtplib
import ssl
import threading
import time
from email.message import EmailMessage
from pathlib import Path
from typing import Optional

# 🔑 carrega o .env mesmo que este módulo seja importado cedo
from dotenv import load_dotenv
load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASS = os.getenv("SMTP_PASS", "").strip()

SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "no-reply@sailscore.online").strip()
SMTP_FROM_NAME  = os.getenv("SMTP_FROM_NAME", os.getenv("DEFAULT_CLUB_NAME", "SailScore")).strip()
DEFAULT_REPLY_TO = os.getenv("DEFAULT_CLUB_REPLY_TO", "").strip()
EMAIL_RETRY_MAX_ATTEMPTS = int(os.getenv("EMAIL_RETRY_MAX_ATTEMPTS", "3"))
EMAIL_RETRY_BASE_SECONDS = float(os.getenv("EMAIL_RETRY_BASE_SECONDS", "1.5"))
EMAIL_QUEUE_FILE = Path(os.getenv("EMAIL_QUEUE_FILE", "email_outbox_queue.jsonl")).resolve()
EMAIL_QUEUE_POLL_SECONDS = float(os.getenv("EMAIL_QUEUE_POLL_SECONDS", "10"))
_QUEUE_LOCK = threading.Lock()

def _compose_from(from_email: Optional[str], from_name: Optional[str]) -> str:
    email = (from_email or SMTP_FROM_EMAIL).strip()
    name  = (from_name  or SMTP_FROM_NAME).strip()
    return f'{name} <{email}>' if name else email


def _build_message(
    to: str,
    subject: str,
    html: Optional[str],
    text: Optional[str],
    *,
    from_email: Optional[str],
    from_name: Optional[str],
    reply_to: Optional[str],
) -> EmailMessage:
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
    return msg


def _send_via_smtp(msg: EmailMessage) -> None:
    """Porta 587: SMTP + STARTTLS (Mailtrap Sending). Porta 465: SMTP_SSL."""
    ctx = ssl.create_default_context()
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=25, context=ctx) as s:
            s.ehlo()
            if SMTP_USER and SMTP_PASS:
                s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        return
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=25) as s:
        s.ehlo()
        s.starttls(context=ctx)
        s.ehlo()
        if SMTP_USER and SMTP_PASS:
            s.login(SMTP_USER, SMTP_PASS)
        s.send_message(msg)


def _read_queue_records() -> list[dict]:
    if not EMAIL_QUEUE_FILE.exists():
        return []
    try:
        lines = EMAIL_QUEUE_FILE.read_text(encoding="utf-8").splitlines()
    except Exception:
        return []
    out: list[dict] = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
            if isinstance(rec, dict):
                out.append(rec)
        except Exception:
            continue
    return out


def _write_queue_records(records: list[dict]) -> None:
    EMAIL_QUEUE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = EMAIL_QUEUE_FILE.with_suffix(".tmp")
    payload = "\n".join(json.dumps(r, ensure_ascii=False) for r in records)
    if payload:
        payload += "\n"
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(EMAIL_QUEUE_FILE)


def _enqueue_email(record: dict) -> None:
    with _QUEUE_LOCK:
        records = _read_queue_records()
        records.append(record)
        _write_queue_records(records)


def _next_delay_seconds(attempts: int) -> int:
    # 15s, 30s, 60s, 120s... capped at 15 min
    return min(900, 15 * (2 ** max(0, attempts - 1)))


def process_email_outbox(max_items: int = 25) -> tuple[int, int]:
    """
    Processa a fila persistente de emails.
    Retorna (sent_count, remaining_count).
    """
    if not SMTP_HOST:
        return (0, 0)
    now = int(time.time())
    sent = 0
    with _QUEUE_LOCK:
        records = _read_queue_records()
        if not records:
            return (0, 0)
        remaining: list[dict] = []
        for rec in records:
            if sent >= max_items:
                remaining.append(rec)
                continue
            next_try_at = int(rec.get("next_try_at") or 0)
            if next_try_at > now:
                remaining.append(rec)
                continue
            try:
                msg = _build_message(
                    to=str(rec.get("to") or ""),
                    subject=str(rec.get("subject") or ""),
                    html=rec.get("html"),
                    text=rec.get("text"),
                    from_email=rec.get("from_email"),
                    from_name=rec.get("from_name"),
                    reply_to=rec.get("reply_to"),
                )
                _send_via_smtp(msg)
                sent += 1
                print(f"[EMAIL OUTBOX] Sent queued email to {msg['To']}")
            except Exception as e:
                attempts = int(rec.get("attempts") or 0) + 1
                rec["attempts"] = attempts
                rec["last_error"] = str(e)
                rec["next_try_at"] = now + _next_delay_seconds(attempts)
                remaining.append(rec)
                print(
                    f"[EMAIL OUTBOX] Retry failed for {rec.get('to')}: {e}. "
                    f"next_try_at={rec['next_try_at']}"
                )
        _write_queue_records(remaining)
    return (sent, len(remaining))


def start_email_outbox_worker() -> None:
    """
    Worker daemon que processa a outbox periodicamente.
    Chamar uma vez no startup da app.
    """
    if not SMTP_HOST:
        print("[EMAIL OUTBOX] SMTP not configured; worker not started.")
        return

    def _run() -> None:
        while True:
            try:
                sent, remaining = process_email_outbox()
                if sent or remaining:
                    print(f"[EMAIL OUTBOX] sent={sent} remaining={remaining}")
            except Exception as e:
                print(f"[EMAIL OUTBOX] worker error: {e}")
            time.sleep(max(2.0, EMAIL_QUEUE_POLL_SECONDS))

    t = threading.Thread(target=_run, name="email-outbox-worker", daemon=True)
    t.start()
    print(f"[EMAIL OUTBOX] worker started (poll={EMAIL_QUEUE_POLL_SECONDS}s)")

def enqueue_email_send(
    to: str,
    subject: str,
    html: Optional[str] = None,
    text: Optional[str] = None,
    *,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> None:
    """Persistir o email na outbox para envio assíncrono pelo worker daemon.

    Use isto a partir de endpoints HTTP em vez de chamar `send_email` em direto
    (ou via BackgroundTasks). Garante que o request HTTP volta em milissegundos
    mesmo que o SMTP esteja lento ou inacessível, evitando bloquear os workers
    do uvicorn (1 ou poucos em hobby plans).
    """
    if not (to or "").strip():
        return
    record = {
        "to": to,
        "subject": subject,
        "html": html,
        "text": text,
        "from_email": from_email,
        "from_name": from_name,
        "reply_to": reply_to,
        "attempts": 0,
        "next_try_at": 0,
        "created_at": int(time.time()),
    }
    _enqueue_email(record)
    print(f"[EMAIL QUEUED] to={to} queue_file={EMAIL_QUEUE_FILE}")


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
    msg = _build_message(
        to=to,
        subject=subject,
        html=html,
        text=text,
        from_email=from_email,
        from_name=from_name,
        reply_to=reply_to,
    )

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

    last_err: Exception | None = None
    for attempt in range(1, max(1, EMAIL_RETRY_MAX_ATTEMPTS) + 1):
        try:
            _send_via_smtp(msg)
            print(f"[EMAIL SMTP] Sent to {to}")
            return
        except Exception as e:
            last_err = e
            print(f"[EMAIL ERROR] attempt={attempt} to={to}: {e}")
            if attempt < EMAIL_RETRY_MAX_ATTEMPTS:
                time.sleep(EMAIL_RETRY_BASE_SECONDS * attempt)

    # Persistir na outbox para não perder email
    record = {
        "to": to,
        "subject": subject,
        "html": html,
        "text": text,
        "from_email": from_email,
        "from_name": from_name,
        "reply_to": reply_to,
        "attempts": 0,
        "next_try_at": int(time.time()) + _next_delay_seconds(1),
        "last_error": str(last_err) if last_err else "unknown",
        "created_at": int(time.time()),
    }
    _enqueue_email(record)
    print(
        f"[EMAIL QUEUED] to={to} reason={record['last_error']} "
        f"queue_file={EMAIL_QUEUE_FILE}"
    )
