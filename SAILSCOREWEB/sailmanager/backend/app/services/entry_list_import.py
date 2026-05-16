"""Fetch and parse external regatta entry-list HTML (e.g. federation 'Lista de Inscritos')."""
from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass, asdict
from typing import Any, Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

_FETCH_TIMEOUT = 30
_USER_AGENT = "SailScore-EntryImport/1.0 (+https://sailscore.online)"

_HEADER_ALIASES: dict[str, list[str]] = {
    "registration": [
        "nº de inscrição",
        "n de inscrição",
        "no de inscricao",
        "nº inscrição",
        "inscrição",
        "inscricao",
        "registration",
    ],
    "sail": [
        "identificação de vela",
        "identificacao de vela",
        "identificacao vela",
        "sail identification",
        "vela",
        "sail",
    ],
    "club": ["clube", "club"],
    "helm_name": ["nome do leme", "leme", "helm", "skipper", "timoneiro"],
    "helm_license": ["ld do leme", "licença leme", "licenca leme", "helm license", "ld leme"],
    "crew_name": ["nome do proa", "proa", "crew", "tripulante"],
    "crew_license": ["ld do proa", "licença proa", "licenca proa", "crew license", "ld proa"],
}


@dataclass
class ParsedEntryRow:
    row_number: int
    boat_country_code: str
    sail_number: str
    club: Optional[str] = None
    helm_first_name: str = ""
    helm_last_name: str = ""
    helm_license: Optional[str] = None
    crew_first_name: Optional[str] = None
    crew_last_name: Optional[str] = None
    crew_license: Optional[str] = None
    registration_number: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _normalize_header(text: str) -> str:
    s = (text or "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def _match_column(header: str) -> Optional[str]:
    h = _normalize_header(header)
    if not h:
        return None
    for key, aliases in _HEADER_ALIASES.items():
        for alias in aliases:
            if alias in h or h in alias:
                return key
    return None


def _split_person_name(full: str) -> tuple[str, str]:
    s = re.sub(r"\s+", " ", (full or "").strip())
    if not s:
        return "", ""
    parts = s.split(" ")
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def _parse_sail_identification(raw: str) -> tuple[str, str]:
    s = re.sub(r"\s+", " ", (raw or "").strip().upper())
    if not s:
        return "", ""
    m = re.match(r"^([A-Z]{2,3})\s+(.+)$", s)
    if m:
        return m.group(1), m.group(2).strip()
    if re.match(r"^[A-Z]{2,3}$", s):
        return s, ""
    return "POR", s


def _validate_public_url(url: str) -> str:
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must start with http:// or https://")
    if not parsed.netloc:
        raise ValueError("Invalid URL.")
    host = parsed.hostname or ""
    if host in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("Local URLs are not allowed.")
    try:
        addr = ipaddress.ip_address(host)
        if addr.is_private or addr.is_loopback or addr.is_link_local:
            raise ValueError("Private network URLs are not allowed.")
    except ValueError as e:
        if "Private network" in str(e):
            raise
        # hostname — ok
    return url.strip()


def fetch_entry_list_html(url: str) -> tuple[str, Optional[str]]:
    safe_url = _validate_public_url(url)
    resp = requests.get(
        safe_url,
        timeout=_FETCH_TIMEOUT,
        headers={"User-Agent": _USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    )
    resp.raise_for_status()
    if not resp.text or not resp.text.strip():
        raise ValueError("The page returned empty content.")
    title: Optional[str] = None
    try:
        soup = BeautifulSoup(resp.text[:500000], "html.parser")
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
    except Exception:
        pass
    return resp.text, title


def _score_table(headers: list[str], row_count: int) -> int:
    mapped = sum(1 for h in headers if _match_column(h))
    if mapped < 2:
        return 0
    return mapped * 100 + min(row_count, 500)


def _extract_rows_from_table(table) -> tuple[list[list[str]], list[str]]:
    headers: list[str] = []
    rows: list[list[str]] = []

    thead = table.find("thead")
    if thead:
        header_cells = thead.find_all(["th", "td"])
        headers = [c.get_text(" ", strip=True) for c in header_cells]
    else:
        first_tr = table.find("tr")
        if first_tr:
            header_cells = first_tr.find_all(["th", "td"])
            if header_cells and any(c.name == "th" for c in header_cells):
                headers = [c.get_text(" ", strip=True) for c in header_cells]

    body_rows = table.find_all("tr")
    start = 1 if headers else 0
    if not headers and body_rows:
        first_cells = body_rows[0].find_all(["th", "td"])
        headers = [c.get_text(" ", strip=True) for c in first_cells]
        start = 1

    for tr in body_rows[start:]:
        cells = tr.find_all(["td", "th"])
        if not cells:
            continue
        values = [c.get_text(" ", strip=True) for c in cells]
        if not any(v.strip() for v in values):
            continue
        rows.append(values)

    return rows, headers


def parse_entry_list_html(html: str) -> tuple[list[ParsedEntryRow], list[str], Optional[str]]:
    soup = BeautifulSoup(html[:800000], "html.parser")
    page_title = soup.title.string.strip() if soup.title and soup.title.string else None

    tables = soup.find_all("table")
    if not tables:
        raise ValueError("No table found on the page. Check that the URL shows an entry list.")

    best_rows: list[list[str]] = []
    best_headers: list[str] = []
    best_score = 0

    for table in tables:
        rows, headers = _extract_rows_from_table(table)
        if not headers or not rows:
            continue
        score = _score_table(headers, len(rows))
        if score > best_score:
            best_score = score
            best_rows = rows
            best_headers = headers

    if best_score < 200:
        raise ValueError(
            "Could not recognize entry list columns. Expected headers like "
            "'Identificação de Vela', 'Nome do Leme', 'Clube', etc."
        )

    col_map: dict[str, int] = {}
    for idx, header in enumerate(best_headers):
        key = _match_column(header)
        if key and key not in col_map:
            col_map[key] = idx

    if "sail" not in col_map:
        raise ValueError("Missing sail identification column on the entry list.")

    warnings: list[str] = []
    parsed: list[ParsedEntryRow] = []

    for i, row in enumerate(best_rows, start=1):

        def cell(key: str) -> str:
            idx = col_map.get(key)
            if idx is None or idx >= len(row):
                return ""
            return (row[idx] or "").strip()

        sail_raw = cell("sail")
        country, sail_num = _parse_sail_identification(sail_raw)
        if not sail_num:
            warnings.append(f"Row {i}: skipped — missing sail number.")
            continue

        helm_first, helm_last = _split_person_name(cell("helm_name"))
        if not helm_first and not helm_last:
            warnings.append(f"Row {i}: skipped — missing helm name.")
            continue

        crew_first, crew_last = _split_person_name(cell("crew_name"))
        crew_first_val = crew_first or None
        crew_last_val = crew_last or None
        if not crew_first_val and not crew_last_val:
            crew_first_val = None
            crew_last_val = None

        parsed.append(
            ParsedEntryRow(
                row_number=i,
                boat_country_code=country or "POR",
                sail_number=sail_num,
                club=cell("club") or None,
                helm_first_name=helm_first,
                helm_last_name=helm_last,
                helm_license=cell("helm_license") or None,
                crew_first_name=crew_first_val,
                crew_last_name=crew_last_val,
                crew_license=cell("crew_license") or None,
                registration_number=cell("registration") or None,
            )
        )

    if not parsed:
        raise ValueError("No valid entries found in the table.")

    return parsed, warnings, page_title


def import_placeholder_email(regatta_id: int, country_code: str, sail_number: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "", f"{country_code}{sail_number}".lower()) or "entry"
    return f"import.r{regatta_id}.{slug}@entry.sailscore.local"
