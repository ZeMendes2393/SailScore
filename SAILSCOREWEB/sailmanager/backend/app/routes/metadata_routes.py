# app/routes/metadata_routes.py — metadata endpoints (timezones by country, etc.)
from __future__ import annotations

from fastapi import APIRouter, Query

from app.metadata.timezones import get_timezones_for_country, get_supported_countries

router = APIRouter(prefix="/metadata", tags=["metadata"])


@router.get("/countries")
def list_countries():
    """Return supported countries with timezone data. Public endpoint."""
    return get_supported_countries()


@router.get("/timezones")
def get_timezones(country: str = Query(..., description="ISO 3166-1 alpha-2 country code (e.g. PT, ES)")):
    """Return IANA timezone identifiers for the given country. Public endpoint."""
    timezones = get_timezones_for_country(country)
    return {"country": country.strip().upper(), "timezones": timezones}
