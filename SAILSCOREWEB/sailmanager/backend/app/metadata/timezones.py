# app/metadata/timezones.py
# Maps country_code -> list of valid IANA timezone identifiers.
# This can later be replaced by a dataset from IANA/CLDR without changing callers.

from __future__ import annotations

# ISO 3166-1 alpha-2 country code -> [IANA timezone strings]
# Sorted alphabetically by country code. Add new entries here or replace with CLDR import.
_COUNTRY_TIMEZONES: dict[str, list[str]] = {
    "AT": ["Europe/Vienna"],
    "BE": ["Europe/Brussels"],
    "CH": ["Europe/Zurich"],
    "DE": ["Europe/Berlin"],
    "ES": ["Atlantic/Canary", "Europe/Madrid"],
    "FR": ["Europe/Paris"],
    "GB": ["Europe/London"],
    "GR": ["Europe/Athens"],
    "IE": ["Europe/Dublin"],
    "IT": ["Europe/Rome"],
    "NL": ["Europe/Amsterdam"],
    "PT": ["Atlantic/Azores", "Atlantic/Madeira", "Europe/Lisbon"],
    "SE": ["Europe/Stockholm"],
    "US": [
        "America/Anchorage",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/New_York",
        "Pacific/Honolulu",
    ],
}


def get_timezones_for_country(country_code: str) -> list[str]:
    """Return IANA timezone identifiers for the given country.
    Returns empty list if country is unknown."""
    if not country_code or not isinstance(country_code, str):
        return []
    key = country_code.strip().upper()
    return list(_COUNTRY_TIMEZONES.get(key, []))


def get_supported_countries() -> list[dict[str, str]]:
    """Return list of {code, name} for countries with timezone data.
    Name can later come from CLDR."""
    # Minimal display names; can be replaced with CLDR names
    _names: dict[str, str] = {
        "AT": "Austria",
        "BE": "Belgium",
        "CH": "Switzerland",
        "DE": "Germany",
        "ES": "Spain",
        "FR": "France",
        "GB": "United Kingdom",
        "GR": "Greece",
        "IE": "Ireland",
        "IT": "Italy",
        "NL": "Netherlands",
        "PT": "Portugal",
        "SE": "Sweden",
        "US": "United States",
    }
    return [
        {"code": code, "name": _names.get(code, code)}
        for code in sorted(_COUNTRY_TIMEZONES.keys())
    ]


def is_valid_timezone_for_country(timezone: str, country_code: str) -> bool:
    """Check if the IANA timezone is valid and belongs to the country."""
    if not timezone or not isinstance(timezone, str):
        return False
    tz = timezone.strip()
    if not tz:
        return False
    allowed = get_timezones_for_country(country_code)
    return tz in allowed


def is_valid_iana_timezone(timezone: str) -> bool:
    """Check if the string is a valid IANA timezone (using zoneinfo).
    Does NOT check country membership."""
    if not timezone or not isinstance(timezone, str):
        return False
    tz = timezone.strip()
    if not tz:
        return False
    try:
        from zoneinfo import ZoneInfo
        ZoneInfo(tz)
        return True
    except Exception:
        return False
