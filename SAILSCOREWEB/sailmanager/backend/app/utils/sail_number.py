"""Sail number normalization: digits only; country code is stored separately."""
from __future__ import annotations

import re
from typing import Optional, Tuple

SAIL_NUMBER_MAX_LEN = 15
_COUNTRY_SAIL_RE = re.compile(r"^([A-Z]{2,3})\s*(\d+)\s*$", re.IGNORECASE)
_COUNTRY_PREFIX_RE = re.compile(r"^([A-Z]{2,3})(\d+)$", re.IGNORECASE)


def extract_sail_digits(raw: Optional[str]) -> str:
    """Return digits only. Strips a leading country code if pasted as one token (e.g. POR30275)."""
    s = re.sub(r"\s+", "", (raw or "").strip().upper())
    if not s:
        return ""
    m = _COUNTRY_PREFIX_RE.match(s)
    if m:
        return m.group(2)
    return re.sub(r"\D", "", raw or "")


def normalize_sail_number_required(raw: Optional[str]) -> str:
    digits = extract_sail_digits(raw)
    if not digits:
        raise ValueError("Sail number must contain digits only (e.g. 30275).")
    if len(digits) > SAIL_NUMBER_MAX_LEN:
        raise ValueError(f"Sail number is too long (max {SAIL_NUMBER_MAX_LEN} digits).")
    return digits


def normalize_sail_number_optional(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    return normalize_sail_number_required(s)


def parse_sail_identification(raw: str) -> Tuple[str, str]:
    """
    Parse federation-style sail id (e.g. 'POR 30275', 'POR30275') into (country_code, sail_digits).
    """
    s = re.sub(r"\s+", " ", (raw or "").strip().upper())
    if not s:
        return "", ""
    m = re.match(r"^([A-Z]{2,3})\s+(.+)$", s)
    if m:
        country = m.group(1).upper()
        digits = extract_sail_digits(m.group(2))
        return country, digits
    compact = re.sub(r"\s+", "", s)
    m2 = _COUNTRY_PREFIX_RE.match(compact)
    if m2:
        return m2.group(1).upper(), m2.group(2)
    digits = extract_sail_digits(s)
    if digits:
        return "POR", digits
    return "", ""
