# app/services/pdf.py
from __future__ import annotations

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.utils import ImageReader
from pathlib import Path
from datetime import datetime
import os
from typing import Iterable, Tuple, Optional, List

# Diretórios e base pública (FastAPI serve /uploads)
FILES_ROOT = Path(os.getenv("FILES_ROOT", "uploads")).resolve()
PUBLIC_BASE = os.getenv("FILES_PUBLIC_BASE", "/uploads").rstrip("/")

# Opcional: logótipo no cabeçalho (png/jpg/svg rasterizado)
LOGO_PATH = os.getenv("FILES_LOGO_PATH")  # e.g. "./uploads/logo.png"

# ---- helpers de IO ----
def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)

# ---- helpers de desenho ----
MARGIN_L = 50
MARGIN_R = 50
MARGIN_T = 60
MARGIN_B = 50
LINE_GAP = 14

def _now_utc_str() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"

def _wrap_text(text: str, font: str, size: int, max_width: float) -> List[str]:
    """Quebra por palavras para não ultrapassar max_width."""
    if not (text or "").strip():
        return ["—"]
    words = (text or "").split()
    lines: List[str] = []
    cur = ""
    for w in words:
        test = (cur + " " + w).strip()
        if stringWidth(test, font, size) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    # também trata de quebras manuais
    out: List[str] = []
    for ln in lines:
        out.extend(ln.splitlines() if "\n" in ln else [ln])
    return out or ["—"]

def _hline(c: canvas.Canvas, x1: float, x2: float, y: float) -> None:
    c.line(x1, y, x2, y)

def _section_title(c: canvas.Canvas, title: str, page_w: float, y: float) -> float:
    c.setFont("Helvetica-Bold", 12)
    y -= 18
    c.drawString(MARGIN_L, y, title)
    y -= 6
    _hline(c, MARGIN_L, page_w - MARGIN_R, y)
    y -= 10
    c.setFont("Helvetica", 10)
    return y

def _ensure_space(c: canvas.Canvas, page_w: float, page_h: float, y: float, need: float) -> float:
    """Se faltar espaço, imprime rodapé, muda de página e redesenha cabeçalho."""
    if y - need > MARGIN_B:
        return y
    _draw_footer(c, page_w)
    c.showPage()
    return _draw_header(c, page_w, page_h)  # devolve novo y

def _draw_header(
    c: canvas.Canvas,
    page_w: float,
    page_h: float,
    *,
    title: str = "",
    regatta_name: Optional[str] = None,
    venue: Optional[str] = None,
    dates: Optional[str] = None,
) -> float:
    y = page_h - MARGIN_T

    # logo (opcional)
    x_logo = MARGIN_L
    logo_h = 28
    if LOGO_PATH and Path(LOGO_PATH).exists():
        try:
            img = ImageReader(LOGO_PATH)
            iw, ih = img.getSize()
            ratio = logo_h / float(ih)
            lw = iw * ratio
            c.drawImage(img, x_logo, y - logo_h, width=lw, height=logo_h, preserveAspectRatio=True, mask='auto')
            x_text = x_logo + lw + 10
        except Exception:
            x_text = x_logo
    else:
        x_text = x_logo

    # título + subtítulo
    c.setFont("Helvetica-Bold", 14)
    c.drawString(x_text, y, title or "SailScore")
    y -= 18
    c.setFont("Helvetica", 10)

    subtitle = " / ".join([s for s in [regatta_name, venue, dates] if s])
    if subtitle:
        c.drawString(x_text, y, subtitle)
        y -= 6

    # linha separadora
    y -= 8
    _hline(c, MARGIN_L, page_w - MARGIN_R, y)
    y -= 10
    c.setFont("Helvetica", 10)

    return y

def _draw_footer(c: canvas.Canvas, page_w: float) -> None:
    y = MARGIN_B - 20
    _hline(c, MARGIN_L, page_w - MARGIN_R, y + 12)
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(MARGIN_L, y, f"Generated at {_now_utc_str()}")
    page_num = c.getPageNumber()
    txt = f"Page {page_num}"
    w = stringWidth(txt, "Helvetica-Oblique", 9)
    c.drawString(page_w - MARGIN_R - w, y, txt)

def _kv_rows(
    c: canvas.Canvas,
    y: float,
    data: Iterable[Tuple[str, str]],
    page_w: float,
    *,
    cols: int = 2,
) -> float:
    """Desenha pares Label: Value em N colunas."""
    col_gap = 20
    usable = page_w - MARGIN_L - MARGIN_R
    col_w = (usable - (cols - 1) * col_gap) / cols

    items = list(data)
    if not items:
        return y

    for i in range(0, len(items), cols):
        # antes de cada linha, garantir espaço
        y = _ensure_space(c, page_w, A4[1], y, LINE_GAP + 2)
        max_line_h = 0
        for col_idx in range(cols):
            if i + col_idx >= len(items):
                break
            label, value = items[i + col_idx]
            x = MARGIN_L + col_idx * (col_w + col_gap)

            # label
            c.setFont("Helvetica-Bold", 10)
            c.drawString(x, y, f"{label}:")
            # valor
            c.setFont("Helvetica", 10)
            lines = _wrap_text(value or "—", "Helvetica", 10, col_w)
            yy = y - 12
            for line in lines:
                c.drawString(x, yy, line)
                yy -= LINE_GAP
            max_line_h = max(max_line_h, y - yy)
        y -= max_line_h if max_line_h else LINE_GAP
    return y

def _paragraph(c: canvas.Canvas, page_w: float, page_h: float, y: float, text: str) -> float:
    lines = _wrap_text(text or "—", "Helvetica", 10, page_w - MARGIN_L - MARGIN_R)
    for line in lines:
        y = _ensure_space(c, page_w, page_h, y, LINE_GAP)
        c.drawString(MARGIN_L, y, line)
        y -= LINE_GAP
    return y

# ============================================================
# SUBMISSION PDF
# ============================================================
def generate_submitted_pdf(regatta_id: int, protest_id: int, snapshot: dict) -> tuple[str, str]:
    """
    Gera um PDF bem formatado da submissão.
    (disk_path, public_url)  e grava em  uploads/protests/<regatta_id>/submitted_<protest_id>.pdf
    """
    out_dir = FILES_ROOT / "protests" / str(regatta_id)
    _ensure_dir(out_dir)
    file_path = out_dir / f"submitted_{protest_id}.pdf"

    c = canvas.Canvas(str(file_path), pagesize=A4)
    page_w, page_h = A4
    c.setTitle(f"Protest {protest_id} — Submission")

    # header
    y = _draw_header(
        c, page_w, page_h,
        title=f"Protest {protest_id} — Submission",
        regatta_name=snapshot.get("regatta_name") or snapshot.get("event_name"),
        venue=snapshot.get("venue"),
        dates=snapshot.get("event_dates"),
    )

    # META
    y = _section_title(c, "Summary", page_w, y)
    y = _kv_rows(
        c, y, [
            ("Type", str(snapshot.get("type") or "—")),
            ("Group/Fleet", str(snapshot.get("group_name") or "—")),
            ("Race Date", str(snapshot.get("race_date") or "—")),
            ("Race Number", str(snapshot.get("race_number") or "—")),
            ("Initiator Entry ID", str(snapshot.get("initiator_entry_id") or "—")),
            ("Initiator Rep.", str(snapshot.get("initiator_represented_by") or "—")),
            ("Submitted At", str(snapshot.get("submitted_at") or "—")),
        ],
        page_w,
        cols=2,
    )

    # PARTES
    y = _section_title(c, "Parties", page_w, y)
    # Initiator (detalhes se existirem no snapshot)
    init_details = snapshot.get("initiator") or {}
    y = _kv_rows(
        c, y, [
            ("Initiator Sail No", str(init_details.get("sail_no") or "—")),
            ("Initiator Boat", str(init_details.get("boat_name") or "—")),
            ("Class", str(init_details.get("class_name") or "—")),
        ],
        page_w,
        cols=3,
    )
    # Respondents (lista simples)
    respondents = snapshot.get("respondents") or []
    if respondents:
        for idx, r in enumerate(respondents, 1):
            y = _ensure_space(c, page_w, page_h, y, 28)
            y = _section_title(c, f"Respondent {idx}", page_w, y)
            y = _kv_rows(
                c, y, [
                    ("Kind", str(r.get("kind") or "—")),
                    ("Entry ID", str(r.get("entry_id") or "—")),
                    ("Sail/Boat", f"{r.get('sail_no') or '—'} / {r.get('boat_name') or '—'}"),
                    ("Class", str(r.get("class_name") or "—")),
                    ("Free Text", str(r.get("free_text") or "—")),
                    ("Represented by", str(r.get("represented_by") or "—")),
                ],
                page_w,
                cols=2,
            )
    else:
        y = _paragraph(c, page_w, page_h, y, "—")

    # INCIDENTE
    y = _section_title(c, "Incident", page_w, y)
    inc = snapshot.get("incident") or {}
    y = _kv_rows(
        c, y, [
            ("When/Where", str(inc.get("when_where") or snapshot.get("incident_when_where") or "—")),
        ],
        page_w,
        cols=1,
    )
    y = _section_title(c, "Description", page_w, y)
    y = _paragraph(c, page_w, page_h, y, str(inc.get("description") or snapshot.get("incident_description") or "—"))
    y = _section_title(c, "Rules Alleged", page_w, y)
    y = _paragraph(c, page_w, page_h, y, str(inc.get("rules_applied") or snapshot.get("rules_alleged") or "—"))

    # footer final
    _draw_footer(c, page_w)
    c.showPage()
    c.save()

    public_url = f"{PUBLIC_BASE}/protests/{regatta_id}/{file_path.name}"
    return str(file_path), public_url

# ============================================================
# DECISION PDF
# ============================================================
def generate_decision_pdf(regatta_id: int, protest_id: int, decision: dict) -> tuple[str, str]:
    """
    Gera um PDF da decisão com secções formais.
    (disk_path, public_url)  e grava em  uploads/protests/<regatta_id>/decision_<protest_id>.pdf
    """
    out_dir = FILES_ROOT / "protests" / str(regatta_id)
    _ensure_dir(out_dir)
    file_path = out_dir / f"decision_{protest_id}.pdf"

    c = canvas.Canvas(str(file_path), pagesize=A4)
    page_w, page_h = A4
    case_no = decision.get("case_number") or "—"
    c.setTitle(f"Hearing Decision — Case {case_no}")

    # header
    y = _draw_header(
        c, page_w, page_h,
        title=f"Hearing Decision — Case {case_no}",
        regatta_name=decision.get("regatta_name") or decision.get("event_name"),
        venue=decision.get("venue"),
        dates=decision.get("event_dates"),
    )

    # META
    y = _section_title(c, "Summary", page_w, y)
    y = _kv_rows(
        c, y, [
            ("Type", str(decision.get("type") or "—")),
            ("Hearing Status", str(decision.get("hearing_status") or "—")),
            ("Valid", str(decision.get("valid") or "—")),
            ("Date of Race", str(decision.get("date_of_race") or "—")),
            ("Time Received", str(decision.get("received_time") or "—")),
            ("Class/Fleet", str(decision.get("class_fleet") or "—")),
        ],
        page_w,
        cols=2,
    )

    # PARTES / TESTEMUNHAS
    y = _section_title(c, "Parties", page_w, y)
    parties = decision.get("parties") or []
    y = _paragraph(c, page_w, page_h, y, "\n".join(parties) if parties else "—")

    y = _section_title(c, "Witnesses", page_w, y)
    witnesses = decision.get("witnesses") or []
    y = _paragraph(c, page_w, page_h, y, "\n".join(witnesses) if witnesses else "—")

    # CORPO DA DECISÃO
    y = _section_title(c, "Case Summary", page_w, y)
    y = _paragraph(c, page_w, page_h, y, str(decision.get("case_summary") or "—"))

    y = _section_title(c, "Procedural Matters", page_w, y)
    y = _paragraph(c, page_w, page_h, y, str(decision.get("procedural_matters") or "—"))

    y = _section_title(c, "Facts Found", page_w, y)
    y = _paragraph(c, page_w, page_h, y, str(decision.get("facts_found") or "—"))

    y = _section_title(c, "Conclusions & Rules", page_w, y)
    y = _paragraph(c, page_w, page_h, y, str(decision.get("conclusions_and_rules") or "—"))

    y = _section_title(c, "Decision", page_w, y)
    y = _paragraph(c, page_w, page_h, y, str(decision.get("decision_text") or "—"))

    y = _section_title(c, "Short Decision", page_w, y)
    y = _paragraph(c, page_w, page_h, y, str(decision.get("short_decision") or "—"))

    # PAINEL / ASSINATURAS
    y = _section_title(c, "Panel", page_w, y)
    panel_lines = [
        f"Chair: {decision.get('panel_chair') or '—'}",
        f"Members: {', '.join(decision.get('panel_members') or []) or '—'}",
    ]
    y = _paragraph(c, page_w, page_h, y, "\n".join(panel_lines))

    y = _section_title(c, "Decision Timestamp", page_w, y)
    y = _kv_rows(
        c, y, [
            ("Decision Date", str(decision.get("decision_date") or "—")),
            ("Decision Time", str(decision.get("decision_time") or "—")),
        ],
        page_w,
        cols=2,
    )

    # espaço para assinaturas
    y = _ensure_space(c, page_w, page_h, y, 80)
    c.setFont("Helvetica", 10)
    c.drawString(MARGIN_L, y, "Chair Signature: ___________________________")
    c.drawString(page_w/2, y, "Member Signature: _________________________")
    y -= 30
    c.drawString(MARGIN_L, y, "Member Signature: _________________________")
    c.drawString(page_w/2, y, "Member Signature: _________________________")

    # footer final
    _draw_footer(c, page_w)
    c.showPage()
    c.save()

    public_url = f"{PUBLIC_BASE}/protests/{regatta_id}/{file_path.name}"
    return str(file_path), public_url
