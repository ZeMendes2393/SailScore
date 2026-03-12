# app/services/results_pdf.py
"""
Generate PDF for published overall results and race results.

Layout:
- top banner split in two:
  - left: regatta logo
  - right: first homepage image
  both with the same height
- below banner: event title/dates + published timestamp
- overall title / race title
- results table with weighted column widths
- wrapped text in cells (no hard truncation for long names)
- dynamic row height based on wrapped content
- sponsors section after the table with extra spacing
"""
from __future__ import annotations

import io
import math
import os
import urllib.request
from pathlib import Path
from typing import Any, Iterable, Dict, List

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics

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
    "place": "#",
    "fleet": "Fleet",
    "sail_no": "Sail #",
    "boat": "Boat",
    "skipper": "Skipper",
    "class": "Class",
    "model": "Model",
    "bow": "Bow",
    "total": "Total",
    "net": "Net",
}

COLUMN_WIDTH_WEIGHTS: dict[str, float] = {
    "place": 0.70,
    "fleet": 0.90,
    "sail_no": 1.45,
    "boat": 1.55,
    "skipper": 1.75,
    "class": 1.10,
    "model": 1.10,
    "bow": 0.80,
    "total": 0.95,
    "net": 0.95,
}

COLUMN_MAX_GROWTH: dict[str, float] = {
    "place": 1.0,
    "fleet": 1.1,
    "sail_no": 1.55,  # allow more growth for flag + "XXX 9999"
    "boat": 1.50,
    "skipper": 1.55,
    "class": 1.25,
    "model": 1.20,
    "bow": 1.0,
    "total": 1.0,
    "net": 1.0,
}

RACE_COLUMN_WEIGHT = 0.92
RACE_COLUMN_MAX_GROWTH = 1.10

# Fleet name -> (R, G, B) for PDF (0-1 range). Matches website FLEET_COLOR_CLASSES.
FLEET_COLORS_RGB: dict[str, tuple[float, float, float]] = {
    "yellow": (251 / 255, 191 / 255, 36 / 255),
    "blue": (59 / 255, 130 / 255, 246 / 255),
    "red": (239 / 255, 68 / 255, 68 / 255),
    "green": (34 / 255, 197 / 255, 94 / 255),
    "gold": (234 / 255, 179 / 255, 8 / 255),
    "silver": (156 / 255, 163 / 255, 175 / 255),
    "bronze": (180 / 255, 83 / 255, 9 / 255),
    "emerald": (16 / 255, 185 / 255, 129 / 255),
}

FONT_TABLE_HEADER = "Helvetica-Bold"
FONT_TABLE_BODY = "Helvetica"
FONT_TITLE = "Helvetica-Bold"
FONT_NORMAL = "Helvetica"

TABLE_HEADER_FONT_SIZE = 6.5
TABLE_BODY_FONT_SIZE = 6.5
TABLE_LINE_HEIGHT = 3.1 * mm
CELL_PADDING_X = 1.6 * mm
CELL_PADDING_Y = 1.2 * mm
MAX_CELL_LINES = 2
SPONSOR_TOP_GAP = 12 * mm


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


def _load_image(url_or_path: str, root: Path | None = None) -> ImageReader | None:
    """Load image from local path (if /uploads/...) or from URL (e.g. flagcdn)."""
    url_or_path = (url_or_path or "").strip()
    if not url_or_path:
        return None

    base_root = root or FILES_ROOT

    try:
        if url_or_path.startswith("/uploads/"):
            rel = url_or_path.replace("/uploads/", "").lstrip("/")
            path = base_root / rel
            if path.exists():
                return ImageReader(str(path))
            return None

        if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
            req = urllib.request.Request(url_or_path, headers={"User-Agent": "SailScore/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return ImageReader(io.BytesIO(resp.read()))

        local_path = base_root / url_or_path.lstrip("/")
        if local_path.exists():
            return ImageReader(str(local_path))

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


def _truncate(text: Any, max_len: int) -> str:
    s = str(text or "")
    if max_len <= 0:
        return ""
    if len(s) <= max_len:
        return s
    if max_len <= 1:
        return s[:max_len]
    return s[: max_len - 1] + "…"


def _safe_float_str(value: Any, decimals: int = 2) -> str:
    if value is None or value == "":
        return "—"
    try:
        return f"{float(value):.{decimals}f}"
    except Exception:
        return str(value)


def _format_points(val: Any) -> str:
    """Format points: integer when whole, else minimal decimals (no trailing .00)."""
    if val is None:
        return "—"
    try:
        f = float(val)
        return str(int(f)) if f == int(f) else f"{f:g}"
    except (TypeError, ValueError):
        return str(val) or "—"


def _string_width(text: Any, font_name: str, font_size: float) -> float:
    return pdfmetrics.stringWidth(str(text or ""), font_name, font_size)


def _wrap_text(
    text: Any,
    max_width: float,
    font_name: str,
    font_size: float,
    max_lines: int = MAX_CELL_LINES,
) -> list[str]:
    s = str(text or "—").strip()
    if not s:
        return ["—"]

    if max_width <= 4:
        return [_truncate(s, 1)]

    words = s.split()
    if not words:
        return [s]

    lines: list[str] = []
    current = ""

    for word in words:
        candidate = word if not current else f"{current} {word}"
        if _string_width(candidate, font_name, font_size) <= max_width:
            current = candidate
            continue

        if current:
            lines.append(current)
            current = word
        else:
            # single very long token: split by characters
            piece = ""
            for ch in word:
                cand = piece + ch
                if _string_width(cand, font_name, font_size) <= max_width:
                    piece = cand
                else:
                    if piece:
                        lines.append(piece)
                    piece = ch
                    if len(lines) >= max_lines:
                        break
            current = piece
            if len(lines) >= max_lines:
                break

        if len(lines) >= max_lines:
            break

    if len(lines) < max_lines and current:
        lines.append(current)

    if len(lines) > max_lines:
        lines = lines[:max_lines]

    # if text still overflowed, ellipsize last line
    joined = " ".join(lines)
    if len(joined) < len(s):
        last = lines[-1]
        while last and _string_width(last + "…", font_name, font_size) > max_width:
            last = last[:-1]
        lines[-1] = (last + "…") if last else "…"

    return lines or ["—"]


def _min_width_for_lines(
    text: Any,
    font_name: str,
    font_size: float,
    max_lines: int = MAX_CELL_LINES,
    min_width: float = 10 * mm,
    max_width: float = 90 * mm,
) -> float:
    s = str(text or "—").strip()
    if not s:
        return min_width

    lo = min_width
    hi = max_width
    for _ in range(16):
        mid = (lo + hi) / 2.0
        lines = _wrap_text(s, mid, font_name, font_size, max_lines=max_lines)
        if len(lines) <= max_lines and not lines[-1].endswith("…"):
            hi = mid
        else:
            lo = mid
    return min(max(hi, min_width), max_width)


def _draw_multiline_text(
    c: canvas.Canvas,
    x: float,
    y_top_inside: float,
    lines: list[str],
    font_name: str,
    font_size: float,
    line_height: float,
) -> None:
    c.setFont(font_name, font_size)
    y = y_top_inside - font_size
    for line in lines:
        c.drawString(x, y, line)
        y -= line_height


def _fleet_rgb(fleet_name: str | None) -> tuple[float, float, float] | None:
    """Return RGB (0-1) for fleet, or None if unknown."""
    if not fleet_name:
        return None
    key = str(fleet_name).strip().lower()
    return FLEET_COLORS_RGB.get(key)


def _draw_fleet_dot(c: canvas.Canvas, x: float, y_center: float, radius: float, rgb: tuple[float, float, float]) -> float:
    """Draw a filled circle and return the x offset after the dot (for text)."""
    c.setFillColorRGB(*rgb)
    c.circle(x + radius, y_center, radius, fill=1, stroke=0)
    c.setFillColorRGB(0, 0, 0)
    return x + 2 * radius + 1.0 * mm  # gap between dot and text


def _overall_cell_text(row: dict[str, Any], col_id: str, row_index: int) -> str:
    if col_id == "place":
        return str(row.get("overall_rank", row_index + 1))
    if col_id == "fleet":
        return str(row.get("finals_fleet") or "—")
    if col_id == "sail_no":
        sail_no = str(row.get("sail_number") or "")
        code = str(row.get("boat_country_code") or "")[:3]
        return f"{code} {sail_no}".strip() or "—"
    if col_id == "boat":
        return str(row.get("boat_name") or "—")
    if col_id == "skipper":
        return str(row.get("skipper_name") or "—")
    if col_id == "class":
        return str(row.get("class_name") or "—")
    if col_id == "model":
        return str(row.get("boat_model") or "—")
    if col_id == "bow":
        return str(row.get("bow_number") or "—")
    if col_id == "total":
        return _format_points(row.get("total_points"))
    if col_id == "net":
        pts = row.get("net_points") if row.get("net_points") is not None else row.get("total_points")
        return _format_points(pts)

    per_race = row.get("per_race") or {}
    val = per_race.get(col_id, "—")
    if isinstance(val, (int, float)):
        return _format_points(val)
    s_raw = str(val).replace("\u200B", "").strip()
    try:
        f = float(s_raw)
        return _format_points(f)
    except (TypeError, ValueError):
        pass
    return s_raw or "—"


def _race_cell_text(result: Any, col_id: str, row_index: int) -> str:
    if col_id == "place":
        return str(getattr(result, "position", row_index + 1))
    if col_id == "sail_no":
        sail_no = str(getattr(result, "sail_number", "") or "")
        code = (getattr(result, "boat_country_code", "") or "")[:3]
        return f"{code} {sail_no}".strip() or "—"
    if col_id == "boat":
        return str(getattr(result, "boat_name", "") or "—")
    if col_id == "skipper":
        return str(getattr(result, "skipper_name", "") or "—")
    if col_id == "rating":
        return _safe_float_str(getattr(result, "rating", None), decimals=3)
    if col_id == "finish_time":
        return str(getattr(result, "finish_time", "") or "—")
    if col_id == "elapsed_time":
        return str(getattr(result, "elapsed_time", "") or "—")
    if col_id == "corrected_time":
        return str(getattr(result, "corrected_time", "") or "—")
    if col_id == "delta":
        return str(getattr(result, "delta", "") or "—")
    if col_id == "code":
        return str(getattr(result, "code", "") or "—")
    if col_id == "points":
        return _format_points(getattr(result, "points", None))
    return "—"


def _compute_column_widths(
    headers: list[str],
    table_w: float,
    rows: list[dict[str, Any]] | None = None,
) -> tuple[list[float], list[float]]:
    weights: list[float] = []
    base_widths: list[float] = []

    for h in headers:
        weight = COLUMN_WIDTH_WEIGHTS.get(h, RACE_COLUMN_WEIGHT)
        weights.append(weight)

    total_weight = sum(weights) if weights else 1.0
    base_widths = [(table_w * w / total_weight) for w in weights]

    if not rows:
        col_x: list[float] = []
        current_x = 0.0
        for w in base_widths:
            col_x.append(current_x)
            current_x += w
        return base_widths, col_x

    desired_widths = list(base_widths)
    for i, h in enumerate(headers):
        growth = COLUMN_MAX_GROWTH.get(h, RACE_COLUMN_MAX_GROWTH)
        max_allowed = base_widths[i] * growth
        min_allowed = base_widths[i]

        samples = [COLUMN_LABELS.get(h, h)]
        for idx, row in enumerate(rows[:25]):
            samples.append(_overall_cell_text(row, h, idx))

        needed = min_allowed
        content_max = max_allowed
        flag_reserve = 0.0
        if h in {"boat", "skipper"}:
            content_max = min(max_allowed, 42 * mm)
        elif h in {"class", "model"}:
            content_max = min(max_allowed, 30 * mm)
        elif h == "sail_no":
            content_max = min(max_allowed, 38 * mm)  # more room for "XXX 9999"
            flag_reserve = 8 * mm  # reserve for flag; add to needed width
        elif h in {"place", "bow", "total", "net"}:
            content_max = min(max_allowed, 18 * mm)
        elif h == "fleet":
            content_max = min(max_allowed, 22 * mm)  # Gold, Silver, Bronze, Emerald

        for txt in samples:
            need = _min_width_for_lines(
                txt,
                FONT_TABLE_BODY,
                TABLE_BODY_FONT_SIZE,
                max_lines=MAX_CELL_LINES,
                min_width=min_allowed,
                max_width=content_max,
            )
            need += flag_reserve
            if need > needed:
                needed = need

        desired_widths[i] = min(max(needed, min_allowed), max_allowed)

    total_desired = sum(desired_widths)
    if total_desired > table_w:
        scale = table_w / total_desired
        desired_widths = [w * scale for w in desired_widths]

    col_x: list[float] = []
    current_x = 0.0
    for w in desired_widths:
        col_x.append(current_x)
        current_x += w

    return desired_widths, col_x


def _draw_table_header(
    c: canvas.Canvas,
    margin: float,
    y: float,
    header_h: float,
    table_w: float,
    headers: list[str],
    col_widths: list[float],
    col_x: list[float],
) -> float:
    c.setFont(FONT_TABLE_HEADER, TABLE_HEADER_FONT_SIZE)
    c.rect(margin, y - header_h, table_w, header_h, stroke=1, fill=0)

    for i, h in enumerate(headers):
        x0 = margin + col_x[i]
        w = col_widths[i]
        label = COLUMN_LABELS.get(h, h)
        usable_w = max(4, w - 2 * CELL_PADDING_X)
        lines = _wrap_text(
            label,
            usable_w,
            FONT_TABLE_HEADER,
            TABLE_HEADER_FONT_SIZE,
            max_lines=2,
        )

        if i < len(headers) - 1:
            c.line(x0 + w, y, x0 + w, y - header_h)

        _draw_multiline_text(
            c,
            x=x0 + CELL_PADDING_X,
            y_top_inside=y - CELL_PADDING_Y + 0.6 * mm,
            lines=lines,
            font_name=FONT_TABLE_HEADER,
            font_size=TABLE_HEADER_FONT_SIZE,
            line_height=TABLE_LINE_HEIGHT,
        )

    return y - header_h


def _draw_overall_table_row(
    c: canvas.Canvas,
    margin: float,
    y: float,
    headers: list[str],
    col_widths: list[float],
    col_x: list[float],
    row: dict[str, Any],
    row_index: int,
) -> float:
    wrapped_by_col: list[list[str]] = []
    max_lines = 1

    for i, col_id in enumerate(headers):
        x0 = margin + col_x[i]
        w = col_widths[i]
        usable_w = max(4, w - 2 * CELL_PADDING_X)

        text = _overall_cell_text(row, col_id, row_index)
        if col_id == "sail_no":
            # reserve some space for the flag
            usable_w = max(4, usable_w - 8 * mm)

        lines = _wrap_text(
            text,
            usable_w,
            FONT_TABLE_BODY,
            TABLE_BODY_FONT_SIZE,
            max_lines=MAX_CELL_LINES,
        )
        wrapped_by_col.append(lines)
        max_lines = max(max_lines, len(lines))

    row_h = max(8 * mm, 2 * CELL_PADDING_Y + max_lines * TABLE_LINE_HEIGHT + 1.0 * mm)
    table_w = sum(col_widths)
    c.rect(margin, y - row_h, table_w, row_h, stroke=1, fill=0)

    for i, col_id in enumerate(headers):
        x0 = margin + col_x[i]
        w = col_widths[i]
        x_cell = x0 + CELL_PADDING_X
        lines = wrapped_by_col[i]

        if col_id == "sail_no":
            boat_cc = row.get("boat_country_code")
            alpha2 = _alpha2_for_flag(boat_cc)
            text_x = x_cell
            if alpha2:
                try:
                    flag_url = f"https://flagcdn.com/w40/{alpha2}.png"
                    img = _load_image(flag_url)
                    if img:
                        iw, ih = img.getSize()
                        if ih > 0:
                            flag_h = min(5.2 * mm, row_h - 2 * CELL_PADDING_Y)
                            ratio = flag_h / ih
                            flag_w = min(iw * ratio, max(6 * mm, w * 0.22))
                            c.drawImage(
                                img,
                                x_cell,
                                y - CELL_PADDING_Y - flag_h,
                                width=flag_w,
                                height=flag_h,
                                preserveAspectRatio=True,
                                mask="auto",
                            )
                            text_x = x_cell + flag_w + 1.4 * mm
                except Exception:
                    pass

            _draw_multiline_text(
                c,
                x=text_x,
                y_top_inside=y - CELL_PADDING_Y + 0.6 * mm,
                lines=lines,
                font_name=FONT_TABLE_BODY,
                font_size=TABLE_BODY_FONT_SIZE,
                line_height=TABLE_LINE_HEIGHT,
            )
        else:
            text_x = x_cell
            if col_id not in COLUMN_LABELS:
                per_race_fleet = row.get("per_race_fleet") or {}
                fleet_label = per_race_fleet.get(col_id)
                rgb = _fleet_rgb(fleet_label)
                if rgb:
                    dot_radius = 0.9 * mm
                    y_center = y - row_h / 2
                    text_x = _draw_fleet_dot(c, x_cell, y_center, dot_radius, rgb)
            _draw_multiline_text(
                c,
                x=text_x,
                y_top_inside=y - CELL_PADDING_Y + 0.6 * mm,
                lines=lines,
                font_name=FONT_TABLE_BODY,
                font_size=TABLE_BODY_FONT_SIZE,
                line_height=TABLE_LINE_HEIGHT,
            )

        if i < len(headers) - 1:
            c.line(x0 + w, y, x0 + w, y - row_h)

    return y - row_h


def _draw_race_table_row(
    c: canvas.Canvas,
    margin: float,
    y: float,
    headers: list[str],
    col_widths: list[float],
    col_x: list[float],
    result: Any,
    row_index: int,
) -> float:
    wrapped_by_col: list[list[str]] = []
    max_lines = 1

    for i, col_id in enumerate(headers):
        w = col_widths[i]
        usable_w = max(4, w - 2 * CELL_PADDING_X)
        if col_id == "sail_no":
            usable_w = max(4, usable_w - 8 * mm)

        text = _race_cell_text(result, col_id, row_index)
        lines = _wrap_text(
            text,
            usable_w,
            FONT_TABLE_BODY,
            TABLE_BODY_FONT_SIZE,
            max_lines=MAX_CELL_LINES,
        )
        wrapped_by_col.append(lines)
        max_lines = max(max_lines, len(lines))

    row_h = max(8 * mm, 2 * CELL_PADDING_Y + max_lines * TABLE_LINE_HEIGHT + 1.0 * mm)
    table_w = sum(col_widths)
    c.rect(margin, y - row_h, table_w, row_h, stroke=1, fill=0)

    for i, col_id in enumerate(headers):
        x0 = margin + col_x[i]
        w = col_widths[i]
        x_cell = x0 + CELL_PADDING_X
        lines = wrapped_by_col[i]

        if col_id == "sail_no":
            boat_cc = getattr(result, "boat_country_code", None)
            alpha2 = _alpha2_for_flag(boat_cc)
            text_x = x_cell
            if alpha2:
                try:
                    flag_url = f"https://flagcdn.com/w40/{alpha2}.png"
                    img = _load_image(flag_url)
                    if img:
                        iw, ih = img.getSize()
                        if ih > 0:
                            flag_h = min(5.2 * mm, row_h - 2 * CELL_PADDING_Y)
                            ratio = flag_h / ih
                            flag_w = min(iw * ratio, max(6 * mm, w * 0.22))
                            c.drawImage(
                                img,
                                x_cell,
                                y - CELL_PADDING_Y - flag_h,
                                width=flag_w,
                                height=flag_h,
                                preserveAspectRatio=True,
                                mask="auto",
                            )
                            text_x = x_cell + flag_w + 1.4 * mm
                except Exception:
                    pass

            _draw_multiline_text(
                c,
                x=text_x,
                y_top_inside=y - CELL_PADDING_Y + 0.6 * mm,
                lines=lines,
                font_name=FONT_TABLE_BODY,
                font_size=TABLE_BODY_FONT_SIZE,
                line_height=TABLE_LINE_HEIGHT,
            )
        else:
            _draw_multiline_text(
                c,
                x=x_cell,
                y_top_inside=y - CELL_PADDING_Y + 0.6 * mm,
                lines=lines,
                font_name=FONT_TABLE_BODY,
                font_size=TABLE_BODY_FONT_SIZE,
                line_height=TABLE_LINE_HEIGHT,
            )

        if i < len(headers) - 1:
            c.line(x0 + w, y, x0 + w, y - row_h)

    return y - row_h


def _draw_banner(
    c: canvas.Canvas,
    regatta: Any,
    root: Path,
    margin: float,
    page_w: float,
    y_top: float,
    banner_h: float,
    banner_gap: float,
    left_logo_w: float,
) -> float:
    banner_y_bottom = y_top - banner_h

    logo_url = getattr(regatta, "listing_logo_url", None) or ""
    hero_img = None
    home_images = getattr(regatta, "home_images", None) or []
    first_hero = home_images[0] if isinstance(home_images, list) and len(home_images) > 0 else None
    if first_hero and isinstance(first_hero, dict):
        hero_url = first_hero.get("url") or ""
        hero_img = _load_image(hero_url, root=root)

    logo_img = _load_image(logo_url, root=root) if logo_url else None

    if logo_img:
        try:
            c.drawImage(
                logo_img,
                margin,
                banner_y_bottom,
                width=left_logo_w,
                height=banner_h,
                preserveAspectRatio=False,
                mask="auto",
            )
        except Exception:
            pass

    right_x = margin + left_logo_w + banner_gap
    right_w = page_w - margin - right_x

    if hero_img:
        try:
            c.drawImage(
                hero_img,
                right_x,
                banner_y_bottom,
                width=right_w,
                height=banner_h,
                preserveAspectRatio=False,
                mask="auto",
            )
        except Exception:
            pass

    return banner_y_bottom - 8 * mm


def _draw_sponsors_section(
    c: canvas.Canvas,
    sponsors_list: list[Any],
    root: Path,
    margin: float,
    page_w: float,
    page_h: float,
    y: float,
) -> float:
    if not sponsors_list:
        return y

    if y < margin + 25 * mm:
        c.showPage()
        y = page_h - margin

    y -= SPONSOR_TOP_GAP

    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin, y, "Sponsors")
    y -= 9 * mm

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

        if category:
            c.setFont("Helvetica-Bold", 9)
            c.drawString(margin, y, category)
            y -= 6 * mm

        x = margin
        for s in items:
            img_url = getattr(s, "image_url", "") or ""
            img = _load_image(img_url, root=root)
            if img:
                try:
                    iw, ih = img.getSize()
                    if ih <= 0:
                        continue

                    r = logo_h_sponsor / ih
                    w = min(iw * r, (page_w - 2 * margin) / max_per_row - 4 * mm)

                    if x + w > page_w - margin:
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

        y -= logo_h_sponsor + 8 * mm

    return y


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

    regatta: model with name, start_date, end_date, listing_logo_url, home_images, results_overall_columns
    data: { "rows": [...], "published_at": iso_str }
    race_names: ordered list of race names for per_race columns
    """
    root = uploads_base_path if uploads_base_path is not None else FILES_ROOT
    rows = data.get("rows") or []
    published_at_iso = data.get("published_at")
    published_at_str = _format_published_at(published_at_iso)

    fixed_cols = _visible_columns(
        getattr(regatta, "results_overall_columns", None),
        class_name,
    )

    fixed_no_total_net = [c for c in fixed_cols if c not in ("total", "net")]

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
    banner_h = 42 * mm
    banner_gap = 4 * mm
    left_logo_w = 42 * mm
    header_h = max(9 * mm, 2 * CELL_PADDING_Y + 2 * TABLE_LINE_HEIGHT + 1 * mm)

    y = page_h - margin

    # ----- TOP BANNER -----
    y = _draw_banner(
        c=c,
        regatta=regatta,
        root=root,
        margin=margin,
        page_w=page_w,
        y_top=y,
        banner_h=banner_h,
        banner_gap=banner_gap,
        left_logo_w=left_logo_w,
    )

    # ----- Event name and dates -----
    c.setFont(FONT_TITLE, 14)
    event_name = getattr(regatta, "name", "") or "Results"
    c.drawString(margin, y, _truncate(event_name, 90))

    c.setFont(FONT_NORMAL, 9)
    if published_at_str:
        c.drawRightString(page_w - margin, y, f"Published at {published_at_str}")

    y -= 6 * mm
    c.setFont(FONT_NORMAL, 10)
    start_d = _format_date(getattr(regatta, "start_date", None))
    end_d = _format_date(getattr(regatta, "end_date", None))
    if start_d and end_d:
        c.drawString(margin, y, f"From {start_d} to {end_d}")

    y -= 8 * mm
    c.setFont(FONT_TITLE, 12)
    c.drawString(margin, y, f"Overall — {class_name}")
    y -= 8 * mm

    # ----- Table -----
    if not all_headers:
        all_headers = ["place"]

    table_w = page_w - 2 * margin
    col_widths, col_x = _compute_column_widths(all_headers, table_w, rows=rows[:25])

    y = _draw_table_header(
        c=c,
        margin=margin,
        y=y,
        header_h=header_h,
        table_w=table_w,
        headers=all_headers,
        col_widths=col_widths,
        col_x=col_x,
    )

    c.setFont(FONT_TABLE_BODY, TABLE_BODY_FONT_SIZE)

    for idx, row in enumerate(rows):
        estimated_row_h = max(8 * mm, 2 * CELL_PADDING_Y + MAX_CELL_LINES * TABLE_LINE_HEIGHT + 1.0 * mm)
        if y < margin + estimated_row_h + 5:
            c.showPage()
            y = page_h - margin
            y = _draw_table_header(
                c=c,
                margin=margin,
                y=y,
                header_h=header_h,
                table_w=table_w,
                headers=all_headers,
                col_widths=col_widths,
                col_x=col_x,
            )
            c.setFont(FONT_TABLE_BODY, TABLE_BODY_FONT_SIZE)

        y = _draw_overall_table_row(
            c=c,
            margin=margin,
            y=y,
            headers=all_headers,
            col_widths=col_widths,
            col_x=col_x,
            row=row,
            row_index=idx,
        )

    # ----- Sponsors -----
    y = _draw_sponsors_section(
        c=c,
        sponsors_list=sponsors_list,
        root=root,
        margin=margin,
        page_w=page_w,
        page_h=page_h,
        y=y,
    )

    c.save()
    return buf.getvalue()


def build_race_results_pdf(
    regatta: Any,
    race: Any,
    results: list[Any],
    sponsors: Iterable[Any] | None = None,
    uploads_base_path: Path | None = None,
) -> bytes:
    """
    Generate PDF for a single race (including handicap time fields).
    Layout reuses the same banner + header style as overall.
    """
    root = uploads_base_path if uploads_base_path is not None else FILES_ROOT
    sponsors_list = list(sponsors or [])

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4

    margin = 15 * mm
    banner_h = 42 * mm
    banner_gap = 4 * mm
    left_logo_w = 42 * mm
    header_h = max(9 * mm, 2 * CELL_PADDING_Y + 2 * TABLE_LINE_HEIGHT + 1 * mm)

    y = page_h - margin

    # Banner
    y = _draw_banner(
        c=c,
        regatta=regatta,
        root=root,
        margin=margin,
        page_w=page_w,
        y_top=y,
        banner_h=banner_h,
        banner_gap=banner_gap,
        left_logo_w=left_logo_w,
    )

    # Header
    c.setFont(FONT_TITLE, 14)
    event_name = getattr(regatta, "name", "") or "Results"
    c.drawString(margin, y, _truncate(event_name, 90))
    y -= 6 * mm

    c.setFont(FONT_NORMAL, 10)
    start_d = _format_date(getattr(regatta, "start_date", None))
    end_d = _format_date(getattr(regatta, "end_date", None))
    if start_d and end_d:
        c.drawString(margin, y, f"From {start_d} to {end_d}")
        y -= 6 * mm

    race_name = (getattr(race, "name", "") or "").strip()
    class_name = (getattr(race, "class_name", "") or "").strip()
    subtitle = f"Race: {race_name}" if race_name else "Race results"
    if class_name:
        subtitle += f" — {class_name}"
    c.drawString(margin, y, _truncate(subtitle, 100))
    y -= 5 * mm
    race_date = getattr(race, "date", None)
    start_time = getattr(race, "start_time", None)
    date_str = _format_date(race_date) if race_date else ""
    if date_str and start_time:
        c.setFont(FONT_NORMAL, 9)
        c.drawString(margin, y, f"{date_str}, Start: {start_time}")
        y -= 5 * mm
    elif date_str:
        c.setFont(FONT_NORMAL, 9)
        c.drawString(margin, y, date_str)
        y -= 5 * mm
    elif start_time:
        c.setFont(FONT_NORMAL, 9)
        c.drawString(margin, y, f"Start: {start_time}")
        y -= 5 * mm
    y -= 5 * mm

    headers = [
        "place",
        "sail_no",
        "boat",
        "skipper",
        "rating",
        "finish_time",
        "elapsed_time",
        "corrected_time",
        "delta",
        "code",
        "points",
    ]

    global COLUMN_LABELS
    race_header_labels = {
        "place": "#",
        "sail_no": "Sail #",
        "boat": "Boat",
        "skipper": "Skipper",
        "rating": "Rating",
        "finish_time": "Finish",
        "elapsed_time": "Elapsed",
        "corrected_time": "Corrected",
        "delta": "Delta",
        "code": "Code",
        "points": "Points",
    }

    # temporarily extend labels for header drawing
    original_labels = dict(COLUMN_LABELS)
    COLUMN_LABELS.update(race_header_labels)

    table_w = page_w - 2 * margin

    race_rows_for_widths = []
    for idx, r in enumerate(results[:25]):
        race_rows_for_widths.append({
            "place": _race_cell_text(r, "place", idx),
            "sail_no": _race_cell_text(r, "sail_no", idx),
            "boat": _race_cell_text(r, "boat", idx),
            "skipper": _race_cell_text(r, "skipper", idx),
            "rating": _race_cell_text(r, "rating", idx),
            "finish_time": _race_cell_text(r, "finish_time", idx),
            "elapsed_time": _race_cell_text(r, "elapsed_time", idx),
            "corrected_time": _race_cell_text(r, "corrected_time", idx),
            "delta": _race_cell_text(r, "delta", idx),
            "code": _race_cell_text(r, "code", idx),
            "points": _race_cell_text(r, "points", idx),
        })

    race_weights = {
        "place": 0.70,
        "sail_no": 1.25,
        "boat": 1.45,
        "skipper": 1.55,
        "rating": 0.95,
        "finish_time": 1.00,
        "elapsed_time": 1.05,
        "corrected_time": 1.10,
        "delta": 0.95,
        "code": 0.75,
        "points": 0.80,
    }
    race_growth = {
        "place": 1.0,
        "sail_no": 1.20,
        "boat": 1.45,
        "skipper": 1.45,
        "rating": 1.0,
        "finish_time": 1.05,
        "elapsed_time": 1.05,
        "corrected_time": 1.10,
        "delta": 1.0,
        "code": 1.0,
        "points": 1.0,
    }

    weights = [race_weights.get(h, 1.0) for h in headers]
    base_widths = [(table_w * w / sum(weights)) for w in weights]
    col_widths = list(base_widths)

    for i, h in enumerate(headers):
        min_allowed = base_widths[i]
        max_allowed = base_widths[i] * race_growth.get(h, 1.10)
        needed = min_allowed
        content_max = min(max_allowed, 36 * mm if h in {"boat", "skipper"} else max_allowed)

        samples = [race_header_labels.get(h, h)] + [rr.get(h, "—") for rr in race_rows_for_widths]
        for txt in samples:
            need = _min_width_for_lines(
                txt,
                FONT_TABLE_BODY,
                TABLE_BODY_FONT_SIZE,
                max_lines=MAX_CELL_LINES,
                min_width=min_allowed,
                max_width=content_max,
            )
            if need > needed:
                needed = need
        col_widths[i] = min(max(needed, min_allowed), max_allowed)

    total_desired = sum(col_widths)
    if total_desired > table_w:
        scale = table_w / total_desired
        col_widths = [w * scale for w in col_widths]

    col_x: list[float] = []
    current_x = 0.0
    for w in col_widths:
        col_x.append(current_x)
        current_x += w

    y = _draw_table_header(
        c=c,
        margin=margin,
        y=y,
        header_h=header_h,
        table_w=table_w,
        headers=headers,
        col_widths=col_widths,
        col_x=col_x,
    )
    c.setFont(FONT_TABLE_BODY, TABLE_BODY_FONT_SIZE)

    for idx, r in enumerate(results):
        estimated_row_h = max(8 * mm, 2 * CELL_PADDING_Y + MAX_CELL_LINES * TABLE_LINE_HEIGHT + 1.0 * mm)
        if y < margin + estimated_row_h + 5:
            c.showPage()
            y = page_h - margin
            y = _draw_table_header(
                c=c,
                margin=margin,
                y=y,
                header_h=header_h,
                table_w=table_w,
                headers=headers,
                col_widths=col_widths,
                col_x=col_x,
            )
            c.setFont(FONT_TABLE_BODY, TABLE_BODY_FONT_SIZE)

        y = _draw_race_table_row(
            c=c,
            margin=margin,
            y=y,
            headers=headers,
            col_widths=col_widths,
            col_x=col_x,
            result=r,
            row_index=idx,
        )

    y = _draw_sponsors_section(
        c=c,
        sponsors_list=sponsors_list,
        root=root,
        margin=margin,
        page_w=page_w,
        page_h=page_h,
        y=y,
    )

    COLUMN_LABELS.clear()
    COLUMN_LABELS.update(original_labels)

    c.save()
    return buf.getvalue()
