"""
Online entry field catalog and per-regatta public form configuration.
Mirrors frontend `src/lib/onlineEntryFields.ts` for IDs/defaults.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from app import models, schemas

# Fields that are always visible/required on public online entry.
LOCKED_CORE_FIELD_IDS = {
    "class_name",
    "first_name",
    "last_name",
    "email",
    "boat_name",
    "boat_country_code",
    "sail_number",
}

# Default required flag for configurable fields (matches requiredUi in frontend catalog).
_CONFIGURABLE_REQUIRED_DEFAULTS: Dict[str, bool] = {
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
    "crew_club": False,
    "crew_federation_license": False,
    "crew_gender": False,
    "crew_helm_country": False,
    "boat_model": False,
    "owner_first_name": False,
    "owner_last_name": False,
    "owner_email": False,
    "category": False,
}

# Default visibility for configurable fields.
_CONFIGURABLE_VISIBLE_DEFAULTS: Dict[str, bool] = {
    field_id: True for field_id in _CONFIGURABLE_REQUIRED_DEFAULTS
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
    "crew_club": "club",
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
    "crew_club",
    "crew_federation_license",
    "crew_gender",
    "crew_helm_country",
}


def _sanitize_bool_map(raw: Any, *, field_name: str, allowed_ids: set[str]) -> Dict[str, bool]:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ValueError(f"{field_name} must be an object.")
    out: Dict[str, bool] = {}
    for key, val in raw.items():
        if not isinstance(key, str):
            continue
        fid = key.strip()
        if fid not in allowed_ids:
            continue
        if not isinstance(val, bool):
            raise ValueError(f"Field '{fid}' must be true or false.")
        out[fid] = val
    return out


def sanitize_required_overrides(raw: Any) -> Dict[str, bool]:
    return _sanitize_bool_map(
        raw,
        field_name="online_entry_field_required",
        allowed_ids=set(_CONFIGURABLE_REQUIRED_DEFAULTS),
    )


def sanitize_visibility_overrides(raw: Any) -> Dict[str, bool]:
    return _sanitize_bool_map(
        raw,
        field_name="online_entry_field_visibility",
        allowed_ids=set(_CONFIGURABLE_VISIBLE_DEFAULTS),
    )


# Backward compatibility for older imports.
def sanitize_overrides(raw: Any) -> Dict[str, bool]:
    return sanitize_required_overrides(raw)


def merge_effective_required(overrides: Optional[Dict[str, bool]]) -> Dict[str, bool]:
    merged = dict(_CONFIGURABLE_REQUIRED_DEFAULTS)
    if overrides:
        for key, val in overrides.items():
            if key in merged and isinstance(val, bool):
                merged[key] = val
    return merged


def merge_effective_visibility(overrides: Optional[Dict[str, bool]]) -> Dict[str, bool]:
    merged = dict(_CONFIGURABLE_VISIBLE_DEFAULTS)
    if overrides:
        for key, val in overrides.items():
            if key in merged and isinstance(val, bool):
                merged[key] = val
    return merged


def normalize_field_overrides(
    required_raw: Any,
    visibility_raw: Any,
) -> Tuple[Dict[str, bool], Dict[str, bool]]:
    """
    Returns compact override maps normalized against defaults.
    Also enforces: hidden fields cannot remain required.
    """
    required_eff = merge_effective_required(sanitize_required_overrides(required_raw))
    visibility_eff = merge_effective_visibility(sanitize_visibility_overrides(visibility_raw))

    for field_id, visible in visibility_eff.items():
        if not visible:
            required_eff[field_id] = False

    required_compact: Dict[str, bool] = {}
    for field_id, default in _CONFIGURABLE_REQUIRED_DEFAULTS.items():
        if required_eff.get(field_id, default) != default:
            required_compact[field_id] = required_eff[field_id]

    visibility_compact: Dict[str, bool] = {}
    for field_id, default in _CONFIGURABLE_VISIBLE_DEFAULTS.items():
        if visibility_eff.get(field_id, default) != default:
            visibility_compact[field_id] = visibility_eff[field_id]

    return required_compact, visibility_compact


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
    return field_id in _CONFIGURABLE_REQUIRED_DEFAULTS


def _is_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _crew_member_has_data(member: dict) -> bool:
    for key in ("first_name", "last_name", "email", "club", "federation_license", "helm_country"):
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
    required_map = merge_effective_required(
        sanitize_required_overrides(getattr(regatta, "online_entry_field_required", None))
    )
    visibility_map = merge_effective_visibility(
        sanitize_visibility_overrides(getattr(regatta, "online_entry_field_visibility", None))
    )
    multi_crew = sailors_per_boat >= 2
    errors: List[str] = []

    for field_id, is_required in required_map.items():
        if not is_required:
            continue
        if not visibility_map.get(field_id, True):
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
