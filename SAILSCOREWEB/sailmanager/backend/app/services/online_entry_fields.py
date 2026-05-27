"""
Online entry field catalog and per-regatta required/optional configuration.
Mirrors frontend lib/onlineEntryFields.ts (field ids and defaults must stay in sync).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException

from app import models, schemas

# Field ids that are always required and cannot be changed per regatta.
LOCKED_CORE_FIELD_IDS: Set[str] = {
    "class_name",
    "first_name",
    "last_name",
    "email",
    "boat_name",
    "boat_country_code",
    "sail_number",
}

# Default required flag for configurable fields (matches requiredUi in frontend catalog).
_CONFIGURABLE_DEFAULTS: Dict[str, bool] = {
    "helm_position": False,
    "date_of_birth": False,
    "gender": True,
    "federation_license": False,
    "contact_phone_1": False,
    "contact_phone_2": False,
    "club": False,
    "helm_country": False,
    "helm_country_secondary": False,
    "territory": False,
    "address": False,
    "zip_code": False,
    "town": False,
    "crew_position": False,
    "crew_first_name": False,
    "crew_last_name": False,
    "crew_email": False,
    "crew_federation_license": False,
    "crew_gender": False,
    "crew_helm_country": False,
    "boat_model": False,
    "owner_first_name": False,
    "owner_last_name": False,
    "owner_email": False,
    "category": False,
}

# field_id -> EntryCreate attribute (helm / boat)
_HELM_ATTR = {
    "helm_position": "helm_position",
    "date_of_birth": "date_of_birth",
    "gender": "gender",
    "federation_license": "federation_license",
    "contact_phone_1": "contact_phone_1",
    "contact_phone_2": "contact_phone_2",
    "club": "club",
    "helm_country": "helm_country",
    "helm_country_secondary": "helm_country_secondary",
    "territory": "territory",
    "address": "address",
    "zip_code": "zip_code",
    "town": "town",
}

_BOAT_ATTR = {
    "boat_model": "boat_model",
    "owner_first_name": "owner_first_name",
    "owner_last_name": "owner_last_name",
    "owner_email": "owner_email",
    "category": "category",
}

_CREW_ATTR = {
    "crew_position": "position",
    "crew_first_name": "first_name",
    "crew_last_name": "last_name",
    "crew_email": "email",
    "crew_federation_license": "federation_license",
    "crew_gender": "gender",
    "crew_helm_country": "helm_country",
}

_APPLIES_HANDICAP_ONLY = {"boat_model", "owner_first_name", "owner_last_name", "owner_email"}
_APPLIES_ONE_DESIGN_ONLY = {"category"}
_APPLIES_MULTI_CREW = {
    "crew_position",
    "crew_first_name",
    "crew_last_name",
    "crew_email",
    "crew_federation_license",
    "crew_gender",
    "crew_helm_country",
}


def configurable_field_ids() -> List[str]:
    return list(_CONFIGURABLE_DEFAULTS.keys())


def sanitize_overrides(raw: Any) -> Dict[str, bool]:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ValueError("online_entry_field_required must be an object.")
    out: Dict[str, bool] = {}
    for key, val in raw.items():
        if not isinstance(key, str):
            continue
        fid = key.strip()
        if fid not in _CONFIGURABLE_DEFAULTS:
            continue
        if not isinstance(val, bool):
            raise ValueError(f"Field '{fid}' must be true or false.")
        out[fid] = val
    return out


def compute_overrides_from_effective(effective: Dict[str, bool]) -> Dict[str, bool]:
    """Store only values that differ from catalog defaults."""
    overrides: Dict[str, bool] = {}
    for fid, default in _CONFIGURABLE_DEFAULTS.items():
        if fid in effective and effective[fid] != default:
            overrides[fid] = effective[fid]
    return overrides


def merge_effective_required(overrides: Optional[Dict[str, bool]]) -> Dict[str, bool]:
    merged = dict(_CONFIGURABLE_DEFAULTS)
    if overrides:
        for k, v in overrides.items():
            if k in merged and isinstance(v, bool):
                merged[k] = v
    return merged


def field_applies(
    field_id: str,
    *,
    class_type: str,
    multi_crew: bool,
) -> bool:
    if field_id in _APPLIES_HANDICAP_ONLY:
        return class_type == "handicap"
    if field_id in _APPLIES_ONE_DESIGN_ONLY:
        return class_type != "handicap"
    if field_id in _APPLIES_MULTI_CREW:
        return multi_crew
    return field_id in _CONFIGURABLE_DEFAULTS


def _is_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _crew_member_has_data(member: dict) -> bool:
    for key in ("first_name", "last_name", "email"):
        if _is_filled(member.get(key)):
            return True
    return False


def validate_online_entry_fields(
    entry: schemas.EntryCreate,
    regatta: models.Regatta,
    *,
    class_type: str,
    sailors_per_boat: int,
) -> None:
    overrides = sanitize_overrides(getattr(regatta, "online_entry_field_required", None))
    required_map = merge_effective_required(overrides)
    multi_crew = sailors_per_boat >= 2
    errors: List[str] = []

    for field_id, is_required in required_map.items():
        if not is_required:
            continue
        if not field_applies(field_id, class_type=class_type, multi_crew=multi_crew):
            continue

        if field_id in _HELM_ATTR:
            attr = _HELM_ATTR[field_id]
            if not _is_filled(getattr(entry, attr, None)):
                errors.append(f"{attr.replace('_', ' ').title()} is required.")
        elif field_id in _BOAT_ATTR:
            attr = _BOAT_ATTR[field_id]
            if not _is_filled(getattr(entry, attr, None)):
                errors.append(f"{attr.replace('_', ' ').title()} is required.")
        elif field_id in _CREW_ATTR:
            crew_key = _CREW_ATTR[field_id]
            members = entry.crew_members or []
            if not members:
                errors.append("At least one crew member is required for this class.")
                break
            for i, member in enumerate(members, start=1):
                if not isinstance(member, dict):
                    continue
                if not _crew_member_has_data(member):
                    continue
                if not _is_filled(member.get(crew_key)):
                    errors.append(
                        f"Crew member #{i}: {crew_key.replace('_', ' ').title()} is required."
                    )

    if errors:
        raise HTTPException(status_code=400, detail=errors[0] if len(errors) == 1 else errors)


def resolve_class_context(
    db,
    regatta_id: int,
    class_name: str,
) -> Tuple[str, int]:
    row = (
        db.query(models.RegattaClass)
        .filter(
            models.RegattaClass.regatta_id == regatta_id,
            models.RegattaClass.class_name == class_name,
        )
        .first()
    )
    if row:
        ct = (row.class_type or "one_design").strip().lower()
        spb = int(row.sailors_per_boat or 1)
        return ("handicap" if ct == "handicap" else "one_design", max(1, spb))
    return "one_design", 1
