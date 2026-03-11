# app/services/results_pdf.py
"""
Generate PDF for published overall results.
Layout: top-left = regatta logo + first hero image; header = event name, From X to Y;
top-right of results = Published at ...; table with columns as configured, flags via flagcdn.
"""
from __future__ import annotations

import io
import os
import urllib.request
from pathlib import Path
from typing import Any, Iterable, Dict, List

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

# ISO 3166-1 alpha-3 (World Sailing) -> alpha-2 for flagcdn
CODE_TO_ALPHA2: dict[str, str] = {
    "ALG": "DZ", "ARG": "AR", "AUS": "AU", "AUT": "AT", "BEL": "BE", "BRA": "BR",
    "BUL": "BG", "CAN": "CA", "CHI": "CL", "CHN": "CN", "CRO": "HR", "CUB": "CU",
    "CYP": "CY", "CZE": "CZ", "DEN": "DK", "ESP": "ES", "EST": "EE", "FIN": "FI",
    "FRA": "FR", "GBR": "GB", "GER": "DE", "GRE": "GR", "HUN": "HU", "IRL": "IE",
    "ITA": "IT", "JPN": "JP", "MEX": "MX", "NED": "NL", "NOR": "NO", "NZL": "NZ",
    "POL": "PL", "POR": "PT", "ROU": "RO", "RUS": "RU", "SUI": "CH", "SWE": "SE",
    "USA": "US", "URU": "UY", "ZIM": "ZW",
}

FILES_ROOT = Path(os.getenv("FILES_ROOT", "uploads")).resolve()

DEFAULT_COLUMNS = [
    "place", "fleet", "sail_no", "boat", "skipper", "class", "model", "bow", "total", "net"
]
COLUMN_LABELS: dict[str, str] = {
    "place": "#", "fleet": "Fleet", "sail_no": "Sail #", "boat": "Boat",
    "skipper": "Skipper", "class": "Class", "model": "Model", "bow": "Bow",
    "total": "Total", "net": "Net",
}


def _visible_columns(saved: Any, class_name: str) -> list[str]:
    """Replicate getVisibleResultsOverallColumnsForClass logic."""
    if saved is None:
        return list(DEFAULT_COLUMNS)
    if isinstance(saved, list) and len(saved) > 0:
        return [c for c in saved if c in COLUMN_LABELS] or list(DEFAULT_COLUMNS)
    if isinstance(saved, dict):
        if class_name and saved.get(class_name):
            return [c for c in saved[class_name] if c in COLUMN_LABELS] or list(DEFAULT_COLUMNS)
        if saved.get("__default__"):
            return [c for c in saved["__default__"] if c in COLUMN_LABELS] or list(DEFAULT_COLUMNS)
    return list(DEFAULT_COLUMNS)


def _alpha2_for_flag(boat_country_code: str | None) -> str:
    """Return ISO alpha-2 for flagcdn from boat_country_code (alpha-3)."""
    if not boat_country_code or len(boat_country_code) != 3:
        return ""
    return CODE_TO_ALPHA2.get(boat_country_code.upper().strip(), "").lower()


def _load_image(url_or_path: str) -> ImageReader | None:
    """Load image from local path (if /uploads/...) or from URL (e.g. flagcdn)."""
    url_or_path = (url_or_path or "").strip()
    if not url_or_path:
        return None
    try:
        if url_or_path.startswith("/uploads/"):
            rel = url_or_path.replace("/uploads/", "").lstrip("/")
            path = FILES_ROOT / rel
            if path.exists():
                return ImageReader(str(path))
            return None
        if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
            req = urllib.request.Request(url_or_path, headers={"User-Agent": "SailScore/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return ImageReader(io.BytesIO(resp.read()))
        return None
    except Exception:
        return None


def _format_published_at(iso_str: str | None) -> str:
    """Format ISO datetime as '11 Mar 2026 at 02:17'."""
    if not iso_str:
        return ""
    try:
        from datetime import datetime
        d = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return f"{d.day} {months[d.month - 1]} {d.year} at {d.hour:02d}:{d.minute:02d}"
    except Exception:
        return str(iso_str)


def _format_date(d: str | None) -> str:
    """Format YYYY-MM-DD as '11 Mar 2026'."""
    if not d:
        return ""
    try:
        parts = d.split("-")
        if len(parts) != 3:
            return d
        y, m, day = parts[0], int(parts[1]), int(parts[2])
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        if 1 <= m <= 12:
            return f"{day} {months[m - 1]} {y}"
        return d
    except Exception:
        return str(d) if d else ""


def build_results_pdf(
    regatta: Any,
    class_name: str,
    data: dict[str, Any],
    race_names: list[str],
    uploads_base_path: Path | None = None,
    sponsors: Iterable[Any] | None = None,
) -> bytes:
    """
    Build PDF bytes for overall results.
    regatta: model with name, start_date, end_date, listing_logo_url, home_images, results_overall_columns.
    data: { "rows": [...], "published_at": iso_str }.
    race_names: ordered list of race names for per_race columns.
    """
    root = uploads_base_path if uploads_base_path is not None else FILES_ROOT
    rows = data.get("rows") or []
    published_at_iso = data.get("published_at")
    published_at_str = _format_published_at(published_at_iso)

    fixed_cols = _visible_columns(
        getattr(regatta, "results_overall_columns", None),
        class_name,
    )
    # Exclude total/net from fixed for header; we add race columns then total, net
    fixed_no_total_net = [c for c in fixed_cols if c not in ("total", "net")]
    # Resolve race column order from param or first row
    race_names_list = list(race_names) if race_names else []
    if not race_names_list and rows and isinstance(rows[0].get("per_race"), dict):
        race_names_list = list(rows[0]["per_race"].keys())
    all_headers = fixed_no_total_net + race_names_list
    if "total" in fixed_cols:
        all_headers.append("total")
    if "net" in fixed_cols:
        all_headers.append("net")

    sponsors_list = list(sponsors or [])

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4
    margin = 15 * mm
    y = page_h
    row_h = 7 * mm
    logo_h = 14 * mm
    hero_max_h = 55 * mm

    # ----- Hero image full-width on top (edge to edge) -----
    home_images = getattr(regatta, "home_images", None) or []
    first_hero = home_images[0] if isinstance(home_images, list) and len(home_images) > 0 else None
    if first_hero and isinstance(first_hero, dict):
        hero_url = first_hero.get("url") or ""
        if hero_url and not hero_url.startswith("http"):
            hero_path = root / hero_url.replace("/uploads/", "").lstrip("/")
            if hero_path.exists():
                try:
                    img = ImageReader(str(hero_path))
                    iw, ih = img.getSize()
                    if iw > 0 and ih > 0:
                        scale = page_w / float(iw)
                        h = min(float(ih) * scale, float(hero_max_h))
                        c.drawImage(
                            img,
                            0,
                            y - h,
                            width=page_w,
                            height=h,
                            preserveAspectRatio=True,
                            mask="auto",
                        )
                        y -= h + 8 * mm
                except Exception:
                    # se falhar, continua sem hero
                    y = page_h - margin
    else:
        # sem hero, começa um pouco abaixo do topo
        y = page_h - margin

    # ----- Top left: regatta logo -----
    x_left = margin
    logo_url = getattr(regatta, "listing_logo_url", None) or ""
    if logo_url and not logo_url.startswith("http"):
        logo_path = root / logo_url.replace("/uploads/", "").lstrip("/")
        if logo_path.exists():
            try:
                img = ImageReader(str(logo_path))
                iw, ih = img.getSize()
                r = logo_h / ih
                c.drawImage(img, x_left, y - logo_h, width=min(iw * r, 35 * mm), height=logo_h, preserveAspectRatio=True, mask="auto")
                x_left += min(iw * r, 35 * mm) + 4 * mm
            except Exception:
                pass

    # ----- Top: event name and dates (right of images) -----
    x_text = margin
    y_text = y
    c.setFont("Helvetica-Bold", 14)
    event_name = getattr(regatta, "name", "") or "Results"
    c.drawString(x_text, y_text, event_name)
    y_text -= 6 * mm
    c.setFont("Helvetica", 10)
    start_d = _format_date(getattr(regatta, "start_date", None))
    end_d = _format_date(getattr(regatta, "end_date", None))
    if start_d and end_d:
        c.drawString(x_text, y_text, f"From {start_d} to {end_d}")
    y_text -= 8 * mm

    # ----- Top right: Published at -----
    if published_at_str:
        c.setFont("Helvetica", 9)
        c.drawRightString(page_w - margin, y, f"Published at {published_at_str}")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, y_text, f"Overall — {class_name}")
    y_text -= 8 * mm

    # Table dimensions
    col_count = len(all_headers)
    if col_count == 0:
        col_count = 1
    table_w = page_w - 2 * margin
    cell_w = table_w / col_count
    header_h = row_h * 1.2
    y_table_top = y_text
    y = y_text

    # Header row
    c.setFont("Helvetica-Bold", 8)
    c.rect(margin, y - header_h, table_w, header_h, stroke=1, fill=0)
    for i, h in enumerate(all_headers):
        label = COLUMN_LABELS.get(h, h)
        if i < len(all_headers) - 1:
            c.line(margin + (i + 1) * cell_w, y, margin + (i + 1) * cell_w, y - header_h)
        c.drawString(margin + i * cell_w + 2, y - header_h + 3, label[:12])
    y -= header_h

    # Data rows
    c.setFont("Helvetica", 8)
    for idx, row in enumerate(rows):
        if y < margin + row_h + 5:
            c.showPage()
            y = page_h - margin
            c.setFont("Helvetica", 8)
        c.rect(margin, y - row_h, table_w, row_h, stroke=1, fill=0)
        for i, col_id in enumerate(all_headers):
            x_cell = margin + i * cell_w + 2
            y_cell = y - row_h + 3
            if col_id == "place":
                val = str(row.get("overall_rank", idx + 1))
                c.drawString(x_cell, y_cell, val)
            elif col_id == "fleet":
                val = str(row.get("finals_fleet") or "—")
                c.drawString(x_cell, y_cell, val[:8])
            elif col_id == "sail_no":
                boat_cc = row.get("boat_country_code")
                alpha2 = _alpha2_for_flag(boat_cc)
                sail_no = str(row.get("sail_number") or "")
                code = str(row.get("boat_country_code") or "")[:3]
                text = f"{code} {sail_no}" if code else sail_no
                if alpha2:
                    try:
                        flag_url = f"https://flagcdn.com/w40/{alpha2}.png"
                        img = _load_image(flag_url)
                        if img:
                            iw, ih = img.getSize()
                            fh = row_h - 2
                            r = fh / ih
                            c.drawImage(img, x_cell, y_cell - 0.5 * mm, width=min(iw * r, cell_w - 6), height=fh, preserveAspectRatio=True, mask="auto")
                            c.drawString(x_cell + 12, y_cell, text[:12])
                        else:
                            c.drawString(x_cell, y_cell, text[:12])
                    except Exception:
                        c.drawString(x_cell, y_cell, text[:12])
                else:
                    c.drawString(x_cell, y_cell, text[:12])
            elif col_id == "boat":
                c.drawString(x_cell, y_cell, (str(row.get("boat_name") or "—"))[:14])
            elif col_id == "skipper":
                c.drawString(x_cell, y_cell, (str(row.get("skipper_name") or "—"))[:14])
            elif col_id == "class":
                c.drawString(x_cell, y_cell, (str(row.get("class_name") or "—"))[:10])
            elif col_id == "model":
                c.drawString(x_cell, y_cell, (str(row.get("boat_model") or "—"))[:10])
            elif col_id == "bow":
                c.drawString(x_cell, y_cell, (str(row.get("bow_number") or "—"))[:6])
            elif col_id == "total":
                pts = row.get("total_points")
                val = f"{float(pts):.2f}" if pts is not None else "—"
                c.drawString(x_cell, y_cell, val)
            elif col_id == "net":
                pts = row.get("net_points") if row.get("net_points") is not None else row.get("total_points")
                val = f"{float(pts):.2f}" if pts is not None else "—"
                c.drawString(x_cell, y_cell, val)
            else:
                # Race column
                per_race = row.get("per_race") or {}
                val = per_race.get(col_id, "—")
                if isinstance(val, float):
                    val = f"{val:.2f}" if val == int(val) else f"{val:.2f}"
                c.drawString(x_cell, y_cell, str(val)[:8])
            if i < len(all_headers) - 1:
                c.line(margin + (i + 1) * cell_w, y, margin + (i + 1) * cell_w, y - row_h)
        y -= row_h

    # ----- Sponsors section (after table) -----
    if sponsors_list:
        # If pouco espaço, nova página
        if y < margin + 25 * mm:
            c.showPage()
            y = page_h - margin

        c.setFont("Helvetica-Bold", 11)
        y -= 4 * mm
        c.drawString(margin, y, "Sponsors")
        y -= 10 * mm

        # Agrupar por categoria
        by_cat: Dict[str, List[Any]] = {}
        for s in sponsors_list:
            cat = getattr(s, "category", "") or ""
            by_cat.setdefault(cat, []).append(s)

        logo_h_sponsor = 14 * mm
        max_per_row = 4
        for category, items in by_cat.items():
            if y < margin + logo_h_sponsor + 10:
                c.showPage()
                y = page_h - margin
                c.setFont("Helvetica-Bold", 11)
                c.drawString(margin, y, "Sponsors (cont.)")
                y -= 8 * mm

            if category:
                c.setFont("Helvetica-Bold", 9)
                c.drawString(margin, y, category)
                y -= 6 * mm

            x = margin
            c.setFont("Helvetica", 8)
            for idx_item, s in enumerate(items):
                img_url = getattr(s, "image_url", "") or ""
                img = _load_image(img_url)
                if img:
                    try:
                        iw, ih = img.getSize()
                        r = logo_h_sponsor / ih
                        w = min(iw * r, (page_w - 2 * margin) / max_per_row - 4 * mm)
                        if x + w > page_w - margin:
                            # nova linha
                            x = margin
                            y -= logo_h_sponsor + 4 * mm
                            if y < margin + logo_h_sponsor + 10:
                                c.showPage()
                                y = page_h - margin
                        c.drawImage(
                            img,
                            x,
                            y - logo_h_sponsor,
                            width=w,
                            height=logo_h_sponsor,
                            preserveAspectRatio=True,
                            mask="auto",
                        )
                        x += w + 6 * mm
                    except Exception:
                        continue
            y -= logo_h_sponsor + 6 * mm

    c.save()
    return buf.getvalue()
