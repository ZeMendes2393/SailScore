from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Optional

PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

def tiny_valid_pdf_bytes(title: str = "SailScore", text: str = "") -> bytes:
    """PDF mínimo válido: tenta ReportLab; se falhar, usa base64 embutido."""
    try:  # pragma: no cover
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from io import BytesIO

        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        w, h = A4
        y = h - 50
        c.setTitle(title)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, y, title)
        y -= 24
        c.setFont("Helvetica", 10)
        for line in (text or "").splitlines():
            y -= 14
            if y < 50:
                c.showPage(); y = h - 50; c.setFont("Helvetica", 10)
            c.drawString(50, y, line)
        c.showPage()
        c.save()
        return buf.getvalue()
    except Exception:
        pass

    b64 = (
        "JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBS"
        "Pj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9Db3VudCAxL0tpZHMgWzMgMCBSXT4+CmVu"
        "ZG9iagozIDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3ggWzAgMCA2MTIg"
        "NzkyXS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXMgPDwvUHJvY1NldFsvUERGXSA+PiA+PgplbmRv"
        "YmoKNCAwIG9iago8PC9MZW5ndGggMCA+PgpcbnN0cmVhbQplbmRzdHJlYW0KZW5kb2JqCnhyZWYK"
        "MCA1CjAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDA2MSAwMDAw"
        "MCBuIAowMDAwMDAwMTE2IDAwMDAwIG4gCjAwMDAwMDAyMTMgMDAwMDAgbiAKdHJhaWxlcgo8PC9T"
        "aXplIDUvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoyNzAKJSVFT0Y="
    )
    import base64 as _b64
    return _b64.b64decode(b64)


# Tenta importar geradores “oficiais”; se não existirem, ficam None.
try:  # pragma: no cover
    from app.services.pdf import generate_submitted_pdf  # type: ignore
except Exception:
    generate_submitted_pdf = None  # type: ignore

try:  # pragma: no cover
    from app.services.pdf import generate_decision_pdf  # type: ignore
except Exception:
    generate_decision_pdf = None  # type: ignore


def normalize_public_url(url: str | None) -> str | None:
    if not url:
        return None
    return url if url.startswith("http") else f"{PUBLIC_BASE_URL}{url}"
