# app/services/pdf.py
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from pathlib import Path
from datetime import datetime
import os

# onde gravar no disco e qual o prefixo público (FastAPI serve /uploads)
FILES_ROOT = Path(os.getenv("FILES_ROOT", "uploads")).resolve()
PUBLIC_BASE = os.getenv("FILES_PUBLIC_BASE", "/uploads").rstrip("/")

def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)

def generate_submitted_pdf(regatta_id: int, protest_id: int, snapshot: dict) -> tuple[str, str]:
    """
    Gera um PDF simples com os dados submetidos.
    Devolve (disk_path, public_url).
    Grava em uploads/protests/<regatta_id>/submitted_<protest_id>.pdf
    """
    out_dir = FILES_ROOT / "protests" / str(regatta_id)
    _ensure_dir(out_dir)
    file_path = out_dir / f"submitted_{protest_id}.pdf"

    c = canvas.Canvas(str(file_path), pagesize=A4)
    w, h = A4
    y = h - 50
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, f"Protest {protest_id} — Submitted Snapshot")
    y -= 25
    c.setFont("Helvetica", 10)

    for k, v in snapshot.items():
        line = f"{k}: {v}"
        for chunk in [line[i:i+100] for i in range(0, len(line), 100)]:
            y -= 14
            if y < 50:
                c.showPage(); y = h - 50; c.setFont("Helvetica", 10)
            c.drawString(50, y, chunk)

    c.setFont("Helvetica-Oblique", 9)
    y -= 20; c.drawString(50, y, f"Generated at {datetime.utcnow().isoformat(timespec='seconds')}Z")
    c.showPage(); c.save()

    public_url = f"{PUBLIC_BASE}/protests/{regatta_id}/{file_path.name}"
    return str(file_path), public_url

def generate_decision_pdf(regatta_id: int, protest_id: int, decision: dict) -> tuple[str, str]:
    """
    Gera um PDF simples com a decisão.
    Devolve (disk_path, public_url).
    Grava em uploads/protests/<regatta_id>/decision_<protest_id>.pdf
    """
    out_dir = FILES_ROOT / "protests" / str(regatta_id)
    _ensure_dir(out_dir)
    file_path = out_dir / f"decision_{protest_id}.pdf"

    c = canvas.Canvas(str(file_path), pagesize=A4)
    w, h = A4; y = h - 50

    def head(t):
        nonlocal y
        c.setFont("Helvetica-Bold", 12); y -= 18; c.drawString(50, y, t)
        y -= 8; c.line(50, y, w-50, y); y -= 10; c.setFont("Helvetica", 10)
    def paragraph(label, text):
        nonlocal y
        head(label)
        for line in (text or "").splitlines() or ["—"]:
            for chunk in [line[i:i+100] for i in range(0, len(line), 100)]:
                if y < 60: c.showPage(); y = h - 50; c.setFont("Helvetica", 10)
                c.drawString(50, y, chunk); y -= 14

    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, f"Hearing Decision — Case {decision.get('case_number') or '—'}")
    y -= 25; c.setFont("Helvetica", 10)

    paragraph("Type", decision.get("type"))
    paragraph("Hearing Status", decision.get("hearing_status"))
    paragraph("Valid / Date / Time", f"{decision.get('valid')} / {decision.get('date_of_race')} / {decision.get('received_time')}")
    paragraph("Class/Fleet", decision.get("class_fleet"))
    paragraph("Parties", "\n".join(decision.get("parties") or []))
    paragraph("Witnesses", "\n".join(decision.get("witnesses") or []))
    paragraph("Case Summary", decision.get("case_summary"))
    paragraph("Procedural Matters", decision.get("procedural_matters"))
    paragraph("Facts Found", decision.get("facts_found"))
    paragraph("Conclusions & Rules", decision.get("conclusions_and_rules"))
    paragraph("Decision", decision.get("decision_text"))
    paragraph("Short Decision", decision.get("short_decision"))
    paragraph("Panel", f"Chair: {decision.get('panel_chair')}\nMembers: {', '.join(decision.get('panel_members') or [])}")

    c.setFont("Helvetica-Oblique", 9)
    y -= 12; c.drawString(50, y, f"Decision Date/Time: {decision.get('decision_date')} {decision.get('decision_time')}")
    y -= 14; c.drawString(50, y, f"Generated at {datetime.utcnow().isoformat(timespec='seconds')}Z")
    c.showPage(); c.save()

    public_url = f"{PUBLIC_BASE}/protests/{regatta_id}/{file_path.name}"
    return str(file_path), public_url
