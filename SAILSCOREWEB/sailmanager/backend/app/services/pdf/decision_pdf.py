from __future__ import annotations

from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfgen.canvas import Canvas

# Paleta
ACCENT = colors.HexColor("#2563EB")        # azul para títulos de secção
ACCENT_LIGHT = colors.HexColor("#EFF6FF")  # fundo clarinho para secções
HEADER_BG = colors.HexColor("#BFDBFE")     # 👈 ainda mais leve
HEADER_TEXT = colors.HexColor("#0F172A")
TEXT = colors.HexColor("#111827")

def _fmt(v: Any, dash: str = "—") -> str:
    if v is None: return dash
    s = str(v).strip()
    return s if s else dash

def _split_lines(s: Optional[str]) -> List[str]:
    if not s: return []
    return [ln.strip() for ln in str(s).replace("\r", "").split("\n") if ln.strip()]

def _bullet_block(lines: List[str], style: ParagraphStyle) -> List[Paragraph]:
    out: List[Paragraph] = []
    for ln in lines:
        if ln.startswith("- "): ln = ln[2:]
        out.append(Paragraph(f"• {ln}", style))
    return out

def _meta_table(pairs: List[Tuple[str, Any]]) -> Table:
    data = [[str(k), _fmt(v)] for k, v in pairs]
    tbl = Table(data, colWidths=[40*mm, 95*mm])
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#374151")),
        ("TEXTCOLOR", (1, 0), (1, -1), TEXT),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return tbl

def _section_title(title: str) -> Table:
    t = Table([[title]], colWidths=[175*mm], rowHeights=[10*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT_LIGHT),
        ("TEXTCOLOR", (0, 0), (-1, -1), ACCENT),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t

def _header(canvas: Canvas, doc: SimpleDocTemplate, regatta_title: str, subtitle: str):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(HEADER_BG)
    canvas.rect(0, h-20*mm, w, 20*mm, stroke=0, fill=1)
    canvas.setFillColor(HEADER_TEXT)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(15*mm, h-12*mm, (regatta_title or "Regatta")[:110])
    canvas.setFont("Helvetica", 10)
    canvas.drawString(15*mm, h-16.5*mm, subtitle[:120])
    canvas.restoreState()

def _footer(canvas: Canvas, doc: SimpleDocTemplate, generated_at_iso: str):
    canvas.saveState()
    w, _ = A4
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.drawRightString(w - 15*mm, 12*mm, f"Generated at {generated_at_iso}   ·   Page {canvas.getPageNumber()}")
    canvas.restoreState()

def generate_decision_pdf(
    regatta_id: int,
    protest_id: int,
    snapshot: Dict[str, Any],
    out_dir: Optional[Path] = None,
    regatta_title: Optional[str] = None,
    venue: Optional[str] = None,
) -> Tuple[Path, str]:
    event = snapshot.get("event") or regatta_title or "Regatta"
    case_number = snapshot.get("case_number") or "—"
    subtitle = f"Hearing Decision — Case {case_number}"

    parties = snapshot.get("parties") or []
    witnesses = snapshot.get("witnesses") or []
    if isinstance(parties, str): parties = _split_lines(parties)
    if isinstance(witnesses, str): witnesses = _split_lines(witnesses)

    generated_at_iso = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    base_dir = out_dir or Path("uploads") / "protests" / str(regatta_id)
    base_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = base_dir / f"decision_{protest_id}.pdf"

    styles = getSampleStyleSheet()
    body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=10, textColor=TEXT, leading=14)

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=35*mm, bottomMargin=20*mm
    )

    story: List[Any] = []

    # SUMMARY
    story += [
        _section_title("Summary"), Spacer(1, 4*mm),
        _meta_table([
            ("Type", snapshot.get("type")),
            ("Hearing Status", snapshot.get("hearing_status")),
            ("Valid", "Yes" if snapshot.get("valid") is True else ("No" if snapshot.get("valid") is False else "—")),
            ("Date of Race", snapshot.get("date_of_race") or snapshot.get("race_date")),
            ("Time Received", snapshot.get("received_time")),
            ("Class/Fleet", snapshot.get("class_fleet") or snapshot.get("class_name") or snapshot.get("fleet")),
        ]),
        Spacer(1, 6*mm),
    ]

    # PARTIES
    story += [_section_title("Parties"), Spacer(1, 3*mm)]
    story += (_bullet_block(parties, body) if parties else [Paragraph("—", body)])
    story.append(Spacer(1, 6*mm))

    # WITNESSES
    story += [_section_title("Witnesses"), Spacer(1, 3*mm)]
    story += (_bullet_block(witnesses, body) if witnesses else [Paragraph("—", body)])
    story.append(Spacer(1, 6*mm))

    # CASE SUMMARY
    if snapshot.get("case_summary"):
        story += [_section_title("Case Summary"), Spacer(1, 3*mm),
                  Paragraph(str(snapshot["case_summary"]).replace("\n", "<br/>"), body), Spacer(1, 6*mm)]

    # PROCEDURAL MATTERS
    if snapshot.get("procedural_matters"):
        story += [_section_title("Procedural Matters"), Spacer(1, 3*mm)]
        story += _bullet_block(_split_lines(snapshot["procedural_matters"]), body)
        story.append(Spacer(1, 6*mm))

    # FACTS FOUND
    story += [_section_title("Facts Found"), Spacer(1, 3*mm)]
    ff_lines = _split_lines(snapshot.get("facts_found"))
    story += (_bullet_block(ff_lines, body) if ff_lines else [Paragraph("—", body)])
    story.append(Spacer(1, 6*mm))

    # CONCLUSIONS & RULES
    story += [_section_title("Conclusions & Rules"), Spacer(1, 3*mm)]
    cr_lines = _split_lines(snapshot.get("conclusions_and_rules") or snapshot.get("conclusion"))
    story += (_bullet_block(cr_lines, body) if cr_lines else [Paragraph("—", body)])
    story.append(Spacer(1, 6*mm))

    # DECISION (opcional)
    if snapshot.get("decision_text"):
        story += [_section_title("Decision"), Spacer(1, 3*mm),
                  Paragraph(str(snapshot["decision_text"]).replace("\n", "<br/>"), body), Spacer(1, 6*mm)]

    # SHORT DECISION
    story += [_section_title("Short Decision"), Spacer(1, 3*mm)]
    sd_tbl = Table([[ _fmt(snapshot.get("short_decision")) ]], colWidths=[175*mm])
    sd_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT_LIGHT),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.5, ACCENT),
    ]))
    story += [sd_tbl, Spacer(1, 6*mm)]

    # PANEL
    story += [_section_title("Panel"), Spacer(1, 3*mm)]
    members = snapshot.get("panel_members") or []
    if isinstance(members, str): members = _split_lines(members)
    panel_tbl = Table([["Chair", _fmt(snapshot.get("panel_chair"))],
                       ["Members", (", ".join(members) if members else "—")]], colWidths=[30*mm, 145*mm])
    panel_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#374151")),
        ("TEXTCOLOR", (1, 0), (1, -1), TEXT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [panel_tbl, Spacer(1, 6*mm)]

    # DECISION TIMESTAMP
    story += [_section_title("Decision Timestamp"), Spacer(1, 3*mm)]
    story += [_meta_table([("Decision Date", snapshot.get("decision_date")),
                           ("Decision Time", snapshot.get("decision_time"))])]

    # build
    def on_page(canvas: Canvas, doc_obj: SimpleDocTemplate):
        _header(canvas, doc_obj, event, subtitle)
        _footer(canvas, doc_obj, generated_at_iso)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)

    from app.routes.protests.helpers import PUBLIC_BASE_URL, normalize_public_url
    public_url = f"{PUBLIC_BASE_URL}/uploads/protests/{regatta_id}/decision_{protest_id}.pdf"
    return pdf_path, normalize_public_url(public_url)
