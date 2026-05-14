# app/schemas.py
from __future__ import annotations

import math
import re
from typing import Optional, List, Dict, Literal, Any, Union
from datetime import datetime, date, time
from pydantic import BaseModel, EmailStr, ConfigDict, Field, TypeAdapter, field_validator


# ---------------------------------------------------------------------------
# Shared field validators for entry-related schemas.
# Normalizam e validam o input ANTES de tocar na DB, evitando 500 por overflow
# de coluna VARCHAR(N) ou por valores numéricos malucos (NaN/Inf).
# ---------------------------------------------------------------------------

_COUNTRY_CODE_RE = re.compile(r"^[A-Z]{2,3}$")
_VALID_RATING_TYPES = {"anc", "orc", "one_design"}
_VALID_HELM_POSITIONS = {"Skipper", "Crew"}
_NUMERIC_RATING_MIN = -1_000.0
_NUMERIC_RATING_MAX = 1_000_000.0
_ENTRY_SAIL_NUMBER_MAX_LEN = 15
_ENTRY_EMAIL_ADAPTER = TypeAdapter(EmailStr)
_PHONE_RE = re.compile(r"^[0-9+()\-\s./]{5,30}$")
_ALLOWED_GENDERS = {"male", "female", "other", "m", "f", "x"}
_MAX_CREW_MEMBERS = 20


def _normalize_country_code(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip().upper()
    if not s:
        return None
    if not _COUNTRY_CODE_RE.match(s):
        raise ValueError("Country code must be 2 or 3 uppercase letters (e.g. POR, GBR, USA).")
    return s


def _normalize_rating_type(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip().lower()
    if not s:
        return None
    if s not in _VALID_RATING_TYPES:
        raise ValueError(
            "Rating type must be one of: anc, orc, one_design (or empty)."
        )
    return s


def _normalize_helm_position(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    # Aceita variações de capitalização vindas do frontend
    canon = s.capitalize()
    if canon not in _VALID_HELM_POSITIONS:
        raise ValueError("Helm position must be 'Skipper' or 'Crew'.")
    return canon


def _validate_finite_rating(v: Optional[float]) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        raise ValueError("Rating must be a number.")
    if math.isnan(f) or math.isinf(f):
        raise ValueError("Rating must be a finite number.")
    if f < _NUMERIC_RATING_MIN or f > _NUMERIC_RATING_MAX:
        raise ValueError(
            f"Rating out of range (allowed between {_NUMERIC_RATING_MIN} and {_NUMERIC_RATING_MAX})."
        )
    return f


def _normalize_required_text(v: Any, *, field_name: str, max_len: int) -> str:
    if v is None:
        raise ValueError(f"{field_name} is required.")
    s = str(v).strip()
    if not s:
        raise ValueError(f"{field_name} is required.")
    if len(s) > max_len:
        raise ValueError(f"{field_name} is too long (max {max_len} characters).")
    return s


def _normalize_optional_text(v: Any, *, field_name: str, max_len: int) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    if len(s) > max_len:
        raise ValueError(f"{field_name} is too long (max {max_len} characters).")
    return s


def _normalize_optional_email(v: Any, *, field_name: str = "Email") -> Optional[str]:
    s = _normalize_optional_text(v, field_name=field_name, max_len=254)
    if s is None:
        return None
    try:
        return str(_ENTRY_EMAIL_ADAPTER.validate_python(s))
    except Exception:
        raise ValueError(f"{field_name} is invalid.")


def _normalize_optional_phone(v: Any, *, field_name: str) -> Optional[str]:
    s = _normalize_optional_text(v, field_name=field_name, max_len=30)
    if s is None:
        return None
    if not _PHONE_RE.match(s):
        raise ValueError(
            f"{field_name} is invalid. Use digits and basic symbols (+ - ( ) . / and spaces)."
        )
    return s


def _normalize_optional_birth_date(v: Any) -> Optional[str]:
    s = _normalize_optional_text(v, field_name="Date of birth", max_len=10)
    if s is None:
        return None
    try:
        dt = datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Date of birth must be in format YYYY-MM-DD.")
    today = date.today()
    if dt > today:
        raise ValueError("Date of birth cannot be in the future.")
    if dt.year < 1900:
        raise ValueError("Date of birth is too old to be valid.")
    return dt.isoformat()


def _normalize_optional_gender(v: Any) -> Optional[str]:
    s = _normalize_optional_text(v, field_name="Gender", max_len=16)
    if s is None:
        return None
    g = s.lower()
    if g not in _ALLOWED_GENDERS:
        raise ValueError("Gender must be one of: male, female, other, m, f, x.")
    if g in {"male", "m"}:
        return "Male"
    if g in {"female", "f"}:
        return "Female"
    return "Other"


def _normalize_crew_members(v: Any) -> Optional[List[Dict[str, Any]]]:
    if v is None:
        return None
    if not isinstance(v, list):
        raise ValueError("Crew members must be a list.")
    if len(v) > _MAX_CREW_MEMBERS:
        raise ValueError(f"Crew members exceeds maximum allowed ({_MAX_CREW_MEMBERS}).")

    normalized: List[Dict[str, Any]] = []
    for i, member in enumerate(v, start=1):
        if not isinstance(member, dict):
            raise ValueError(f"Crew member #{i} must be an object.")
        clean_member: Dict[str, Any] = {}
        for raw_key, raw_value in member.items():
            key = _normalize_required_text(raw_key, field_name=f"Crew member #{i} field", max_len=40)
            if raw_value is None:
                clean_member[key] = None
                continue
            if isinstance(raw_value, (int, float, bool)):
                clean_member[key] = raw_value
                continue
            if isinstance(raw_value, (list, dict)):
                raise ValueError(f"Crew member #{i} field '{key}' must be a primitive value.")

            val = _normalize_optional_text(raw_value, field_name=f"Crew member #{i} field '{key}'", max_len=200)
            if key.lower() in {"email", "owner_email"}:
                clean_member[key] = _normalize_optional_email(val, field_name=f"Crew member #{i} email")
            elif key.lower() in {"phone", "contact_phone", "contact_phone_1", "contact_phone_2"}:
                clean_member[key] = _normalize_optional_phone(val, field_name=f"Crew member #{i} phone")
            elif key.lower() in {"date_of_birth", "dob"}:
                clean_member[key] = _normalize_optional_birth_date(val)
            else:
                clean_member[key] = val
        normalized.append(clean_member)
    return normalized





# =========================
# AUTH
# =========================
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    # Identificador de login:
    # - Admin: email (continua a ser o recomendado)
    # - Sailor Account: username (ex.: JoseMendes115)
    email: str
    password: str
    regatta_id: Optional[int] = None  # usado por regatistas, opcional
    # Slug da organização (website). Obrigatório para admin desse website; omitido = login plataforma (platform_admin).
    org: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# =========================
# ORGANIZATIONS
# =========================
class OrganizationBase(BaseModel):
    name: str
    slug: str
    is_active: bool = True


class OrganizationCreate(OrganizationBase):
    """Criação de website: opcionalmente o primeiro admin (email + password) só desse website."""

    admin_email: Optional[str] = None
    admin_password: Optional[str] = None
    admin_name: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    is_active: Optional[bool] = None
    admin_email: Optional[str] = None  # platform_admin only: altera email do admin do site
    admin_password: Optional[str] = None  # platform_admin only: altera password do admin do site


class OrganizationRead(OrganizationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class OrganizationReadWithAdmin(OrganizationRead):
    """Organização com email do admin (para edição por platform_admin)."""
    admin_email: Optional[str] = None


class MarketingDemoRequestRead(BaseModel):
    """Pedido de demo (lista para platform_admin)."""

    id: int
    created_at: datetime
    full_name: str
    email: str
    club_name: str
    phone: Optional[str] = None
    message: Optional[str] = None
    notification_email_sent: bool
    model_config = ConfigDict(from_attributes=True)


# =========================
# REGATTAS
# =========================
class HomeImageItem(BaseModel):
    """Uma imagem da homepage da regata com ponto focal (estilo Facebook cover)."""
    url: str
    position_x: int = 50  # 0-100, background-position x %
    position_y: int = 50  # 0-100, background-position y %


class RegattaBase(BaseModel):
    # obrigatórios
    name: str
    location: str
    start_date: str
    end_date: str

    # opcionais
    description: Optional[str] = None
    poster_url: Optional[str] = None
    home_images: Optional[List[Dict[str, Any]]] = None  # [{url, position_x, position_y}, ...] max 3
    listing_logo_url: Optional[str] = None
    notice_board_url: Optional[str] = None
    entry_list_url: Optional[str] = None
    online_entry_url: Optional[str] = None

    # scoring / descartes
    discard_count: int = 0
    discard_threshold: int = 4

    # controlo de inscrições online (visível no GET)
    online_entry_open: bool = True
    # Limite total de entradas permitidas (opcional). Quando enabled=true, aplica um cap global.
    online_entry_limit_enabled: bool = False
    online_entry_limit: Optional[int] = None
    # Limites por classe:
    # { "<class_name>": { "enabled": bool, "limit": int|null } }
    online_entry_limits_by_class: Optional[Dict[str, Dict[str, Any]]] = None
    country_code: Optional[str] = None  # ISO 3166-1 alpha-2, ex: PT, ES
    timezone: Optional[str] = None  # IANA, ex: Europe/Lisbon


class RegattaCreate(RegattaBase):
    organization_id: Optional[int] = None  # se omitido, usa org default (sailscore)


class RegattaRead(RegattaBase):
    id: int
    organization_id: int
    organization_slug: Optional[str] = None  # slug público da org (multi-tenant)
    scoring_codes: Optional[Dict[str, float]] = None
    # Por classe: Dict[class_name, List[column_id]]. Legado: List[str] (uma config para todas).
    entry_list_columns: Optional[Union[List[str], Dict[str, List[str]]]] = None
    results_overall_columns: Optional[Union[List[str], Dict[str, List[str]]]] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class RegattaListRead(BaseModel):
    """Resposta do GET /regattas/ para lista/calendário: inclui nomes das classes e online_entry_open."""
    id: int
    organization_id: int
    organization_slug: Optional[str] = None
    name: str
    location: str
    start_date: str
    end_date: str
    online_entry_open: bool = True
    class_names: List[str] = []
    listing_logo_url: Optional[str] = None


class RegattaUpdate(BaseModel):
    organization_id: Optional[int] = None
    name: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    country_code: Optional[str] = None
    timezone: Optional[str] = None

    description: Optional[str] = None
    poster_url: Optional[str] = None
    home_images: Optional[List[Dict[str, Any]]] = None
    listing_logo_url: Optional[str] = None
    notice_board_url: Optional[str] = None
    entry_list_url: Optional[str] = None
    online_entry_url: Optional[str] = None

    # PATCH opcional (por classe: Dict[class_name, List[column_id]])
    online_entry_open: Optional[bool] = None
    online_entry_limit_enabled: Optional[bool] = None
    online_entry_limit: Optional[int] = None
    online_entry_limits_by_class: Optional[Dict[str, Dict[str, Any]]] = None
    entry_list_columns: Optional[Union[List[str], Dict[str, List[str]]]] = None
    results_overall_columns: Optional[Union[List[str], Dict[str, List[str]]]] = None


FinanceKindLiteral = Literal["revenue", "expense"]


class RegattaFinanceLineCreate(BaseModel):
    kind: FinanceKindLiteral
    description: str = Field(..., min_length=1, max_length=500)
    amount: float = Field(..., gt=0)
    currency: str = Field(default="EUR", min_length=3, max_length=8)
    notes: Optional[str] = Field(None, max_length=5000)
    sort_order: int = 0


class RegattaFinanceLineUpdate(BaseModel):
    kind: Optional[FinanceKindLiteral] = None
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=8)
    notes: Optional[str] = Field(None, max_length=5000)
    sort_order: Optional[int] = None


class RegattaFinanceLineRead(BaseModel):
    id: int
    regatta_id: int
    kind: FinanceKindLiteral
    description: str
    amount: float
    currency: str
    notes: Optional[str] = None
    sort_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RegattaClassItem(BaseModel):
    """Uma classe com nome e tipo (one_design | handicap). One Design pode ter sailors_per_boat."""
    class_name: str
    class_type: ClassTypeLiteral = "one_design"
    sailors_per_boat: int = 1  # One Design: nº de velejadores por embarcação (1, 2, 3...)


class RegattaClassesReplace(BaseModel):
    """Substitui classes da regata. Aceita lista de strings (todas one_design) ou de objetos com class_type."""
    classes: List[RegattaClassItem]

    @field_validator("classes", mode="before")
    @classmethod
    def coerce_classes(cls, v: Any) -> List[dict]:
        if not v:
            return []
        out: List[dict] = []
        for x in v:
            if isinstance(x, str):
                s = (x or "").strip()
                if s:
                    out.append({"class_name": s, "class_type": "one_design", "sailors_per_boat": 1})
            elif isinstance(x, dict):
                out.append(x)
            else:
                out.append(x.model_dump() if hasattr(x, "model_dump") else dict(x))
        return out


# =========================
# REGATTA CLASSES
# =========================
ClassTypeLiteral = Literal["one_design", "handicap"]


class RegattaClassCreate(BaseModel):
    regatta_id: int
    class_name: str
    class_type: ClassTypeLiteral = "one_design"


class RegattaClassRead(BaseModel):
    id: int
    regatta_id: int
    class_name: str
    class_type: str = "one_design"
    sailors_per_boat: int = 1
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =========================
# ENTRIES
# =========================
class EntryCreate(BaseModel):
    # boat
    class_name: str
    boat_country: Optional[str] = None
    boat_country_code: str  # obrigatório (ex.: POR, GBR)
    sail_number: str  # obrigatório
    bow_number: Optional[str] = None
    boat_name: Optional[str] = None
    boat_model: Optional[str] = None  # ex: Beneteau First 36.7 (handicap)
    rating: Optional[float] = None  # ANC rating (quando rating_type='anc')
    rating_type: Optional[str] = None  # None | anc | orc
    orc_low: Optional[float] = None
    orc_medium: Optional[float] = None
    orc_high: Optional[float] = None
    category: Optional[str] = None

    # helm
    helm_position: Optional[str] = None  # Skipper | Crew (one design)
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    helm_country: Optional[str] = None
    territory: Optional[str] = None
    club: Optional[str] = None
    email: Optional[str] = None
    contact_phone_1: Optional[str] = None
    contact_phone_2: Optional[str] = None
    address: Optional[str] = None
    zip_code: Optional[str] = None
    town: Optional[str] = None
    helm_country_secondary: Optional[str] = None
    federation_license: Optional[str] = None  # Licença de federação (obrigatório para sailor)

    # Owner (handicap)
    owner_first_name: Optional[str] = None
    owner_last_name: Optional[str] = None
    owner_email: Optional[str] = None

    regatta_id: int
    paid: Optional[bool] = False
    confirmed: Optional[bool] = False

    # Tripulantes opcionais (lista de dicts com first_name, last_name, email, etc.)
    crew_members: Optional[List[Dict[str, Any]]] = None

    @field_validator("boat_country_code")
    @classmethod
    def boat_country_code_non_empty(cls, v: str) -> str:
        if v is None:
            raise ValueError("Sail country code is required.")
        s = (v or "").strip().upper()
        if not s:
            raise ValueError("Sail country code is required.")
        if not _COUNTRY_CODE_RE.match(s):
            raise ValueError("Country code must be 2 or 3 uppercase letters (e.g. POR, GBR, USA).")
        return s

    @field_validator("class_name")
    @classmethod
    def class_name_non_empty(cls, v: str) -> str:
        return _normalize_required_text(v, field_name="Class name", max_len=100)

    @field_validator("sail_number")
    @classmethod
    def sail_number_non_empty(cls, v: str) -> str:
        s = _normalize_required_text(v, field_name="Sail number", max_len=_ENTRY_SAIL_NUMBER_MAX_LEN)
        if len(s) > _ENTRY_SAIL_NUMBER_MAX_LEN:
            raise ValueError(f"Sail number is too long (max {_ENTRY_SAIL_NUMBER_MAX_LEN} characters).")
        return s

    @field_validator(
        "boat_country",
        "bow_number",
        "boat_name",
        "boat_model",
        "category",
        "first_name",
        "last_name",
        "helm_country",
        "territory",
        "club",
        "address",
        "zip_code",
        "town",
        "helm_country_secondary",
        "federation_license",
        "owner_first_name",
        "owner_last_name",
        mode="before",
    )
    @classmethod
    def _v_optional_text_fields(cls, v, info):
        limits = {
            "boat_country": 100,
            "bow_number": 32,
            "boat_name": 120,
            "boat_model": 120,
            "category": 80,
            "first_name": 80,
            "last_name": 80,
            "helm_country": 100,
            "territory": 100,
            "club": 120,
            "address": 250,
            "zip_code": 20,
            "town": 100,
            "helm_country_secondary": 100,
            "federation_license": 64,
            "owner_first_name": 80,
            "owner_last_name": 80,
        }
        field = str(info.field_name)
        return _normalize_optional_text(v, field_name=field.replace("_", " ").title(), max_len=limits[field])

    @field_validator("email", "owner_email", mode="before")
    @classmethod
    def _v_emails(cls, v, info):
        field = "Owner email" if info.field_name == "owner_email" else "Email"
        return _normalize_optional_email(v, field_name=field)

    @field_validator("contact_phone_1", "contact_phone_2", mode="before")
    @classmethod
    def _v_phones(cls, v, info):
        field = "Contact phone 1" if info.field_name == "contact_phone_1" else "Contact phone 2"
        return _normalize_optional_phone(v, field_name=field)

    @field_validator("date_of_birth", mode="before")
    @classmethod
    def _v_date_of_birth(cls, v):
        return _normalize_optional_birth_date(v)

    @field_validator("gender", mode="before")
    @classmethod
    def _v_gender(cls, v):
        return _normalize_optional_gender(v)

    @field_validator("crew_members", mode="before")
    @classmethod
    def _v_crew_members(cls, v):
        return _normalize_crew_members(v)

    @field_validator("rating_type", mode="before")
    @classmethod
    def _v_rating_type(cls, v):
        return _normalize_rating_type(v)

    @field_validator("helm_position", mode="before")
    @classmethod
    def _v_helm_position(cls, v):
        return _normalize_helm_position(v)

    @field_validator("rating", "orc_low", "orc_medium", "orc_high", mode="before")
    @classmethod
    def _v_finite_rating(cls, v):
        return _validate_finite_rating(v)


class EntryRead(EntryCreate):
    id: int
    waiting_list: Optional[bool] = None
    confirmed_email_sent_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class EntryListRead(BaseModel):
    """Schema para listagem: aceita boat_country_code/sail_number nulos vindos do DB."""
    id: int
    class_name: Optional[str] = None
    boat_country: Optional[str] = None
    boat_country_code: Optional[str] = None
    sail_number: Optional[str] = None
    bow_number: Optional[str] = None
    boat_name: Optional[str] = None
    boat_model: Optional[str] = None
    rating: Optional[float] = None
    rating_type: Optional[str] = None
    orc_low: Optional[float] = None
    orc_medium: Optional[float] = None
    orc_high: Optional[float] = None
    category: Optional[str] = None
    helm_position: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    helm_country: Optional[str] = None
    territory: Optional[str] = None
    club: Optional[str] = None
    email: Optional[str] = None
    contact_phone_1: Optional[str] = None
    contact_phone_2: Optional[str] = None
    address: Optional[str] = None
    zip_code: Optional[str] = None
    town: Optional[str] = None
    helm_country_secondary: Optional[str] = None
    federation_license: Optional[str] = None
    owner_first_name: Optional[str] = None
    owner_last_name: Optional[str] = None
    owner_email: Optional[str] = None
    regatta_id: int
    paid: Optional[bool] = False
    confirmed: Optional[bool] = False
    confirmed_email_sent_at: Optional[datetime] = None
    crew_members: Optional[List[Dict[str, Any]]] = None
    created_at: Optional[datetime] = None
    waiting_list: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =========================
# RACES
# =========================
class RaceCreate(BaseModel):
    name: str
    regatta_id: int
    date: Optional[str] = None
    class_name: str
    order_index: Optional[int] = None

    # NOVOS CAMPOS
    is_medal_race: bool = False
    double_points: bool = False
    discardable: bool = True
class RaceRead(BaseModel):
    id: int
    name: str
    regatta_id: int
    date: Optional[str] = None
    class_name: str
    order_index: int
    fleet_set_id: Optional[int] = None

    # NOVOS CAMPOS
    is_medal_race: bool
    double_points: bool
    discardable: bool
    # Handicap / Time Scoring
    start_time: Optional[str] = None
    start_day: Optional[int] = None
    handicap_method: Optional[str] = None  # manual | anc | orc
    orc_rating_mode: Optional[str] = None  # low | medium | high (quando handicap_method=orc)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class RaceUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    order_index: Optional[int] = None

    is_medal_race: Optional[bool] = None
    double_points: Optional[bool] = None
    discardable: Optional[bool] = None
    start_time: Optional[str] = None
    start_day: Optional[int] = None
    handicap_method: Optional[str] = None
    orc_rating_mode: Optional[str] = None




class RacesReorder(BaseModel):
    ordered_ids: List[int]





# =========================
# RESULTS
# =========================
class ResultCreate(BaseModel):
    regatta_id: int
    race_id: int
    sail_number: Optional[str] = None
    boat_country_code: str
    boat_name: Optional[str] = None
    boat_class: Optional[str] = None
    helm_name: Optional[str] = None
    position: Optional[int] = None
    points: Optional[float] = None
    code: Optional[str] = None
    rating: Optional[float] = None
    # Handicap / Time Scoring
    finish_time: Optional[str] = None
    finish_day: Optional[int] = None
    elapsed_time: Optional[str] = None
    corrected_time: Optional[str] = None

    @field_validator("boat_country_code")
    @classmethod
    def result_boat_country_code_non_empty(cls, v: str) -> str:
        if v is None:
            raise ValueError("boat_country_code is required.")
        s = (v or "").strip().upper()
        if not s:
            raise ValueError("boat_country_code is required.")
        return s


class ResultRead(BaseModel):
    id: int
    regatta_id: int
    race_id: int
    sail_number: Optional[str] = None
    boat_country_code: Optional[str] = None
    boat_name: Optional[str] = None
    class_name: Optional[str] = None
    skipper_name: Optional[str] = None
    position: int
    points: float
    code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    points_override: Optional[float] = None
    rating: Optional[float] = None
    finish_time: Optional[str] = None
    finish_day: Optional[int] = None
    elapsed_time: Optional[str] = None
    corrected_time: Optional[str] = None
    delta: Optional[str] = None



class PointsOverridePatch(BaseModel):
    points: float = Field(ge=0)


    class PointsOverridePatch(BaseModel):
        points: float | None = Field(default=None, ge=0)

# =========================
# INVITATIONS
# =========================
class InvitationCreate(BaseModel):
    email: EmailStr
    role: str  # "admin" | "regatista"


class InvitationRead(BaseModel):
    id: int
    email: EmailStr
    role: str
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AcceptInviteInput(BaseModel):
    token: str
    password: Optional[str] = None


# =========================
# SAILOR PROFILE
# =========================
class SailorProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    club: Optional[str] = None
    contact_phone_1: Optional[str] = None
    contact_phone_2: Optional[str] = None
    address: Optional[str] = None
    zip_code: Optional[str] = None
    town: Optional[str] = None
    country: Optional[str] = None
    country_secondary: Optional[str] = None
    territory: Optional[str] = None


# =========================
# NOTICES
# =========================
NoticeSourceLiteral = Literal[
    "ORGANIZING_AUTHORITY", "RACE_COMMITTEE", "JURY", "TECHNICAL_COMMITTEE", "OTHER"
]
NoticeDocTypeLiteral = Literal[
    "RACE_DOCUMENT", "RULE_42", "JURY_DOC", "TECHNICAL", "OTHER"
]


class NoticeRead(BaseModel):
    id: int
    filename: str
    filepath: str
    title: str
    regatta_id: int
    published_at: datetime
    source: NoticeSourceLiteral
    doc_type: NoticeDocTypeLiteral
    is_important: bool
    applies_to_all: bool
    classes: List[str]  # nomes das classes (ex.: ["49er","ILCA 7"])
    model_config = ConfigDict(from_attributes=True)


# =========================
# NEWS (homepage)
# =========================
class NewsItemCreate(BaseModel):
    title: str
    published_at: Optional[datetime] = None  # se omitido, usa now
    excerpt: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None


class NewsItemUpdate(BaseModel):
    title: Optional[str] = None
    published_at: Optional[datetime] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None


class NewsItemRead(BaseModel):
    id: int
    organization_id: int
    title: str
    published_at: datetime
    excerpt: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# =========================
# REGATTA SPONSORS
# =========================
class RegattaSponsorRead(BaseModel):
    id: int
    regatta_id: Optional[int] = None  # None = global (all events)
    category: str
    image_url: str
    link_url: Optional[str] = None
    sort_order: int = 0
    model_config = ConfigDict(from_attributes=True)


class RegattaSponsorCreate(BaseModel):
    category: str
    image_url: str
    link_url: Optional[str] = None
    sort_order: int = 0
    add_to_all_events: bool = False


class RegattaSponsorUpdate(BaseModel):
    category: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    sort_order: Optional[int] = None


# =========================
# RULE 42
# =========================
class Rule42Create(BaseModel):
    regatta_id: int
    sail_num: str
    penalty_number: str
    race: str
    group: Optional[str] = None
    rule: str = "RRS 42"
    comp_action: Optional[str] = None
    description: Optional[str] = None
    class_name: str
    date: date


class Rule42Out(BaseModel):
    id: int
    regatta_id: int
    sail_num: str
    boat_country_code: Optional[str] = None  # for display [Flag] [Code] [Number]
    penalty_number: str
    race: str
    group: Optional[str] = None
    rule: str
    comp_action: Optional[str] = None
    description: Optional[str] = None
    class_name: str
    date: date
    model_config = ConfigDict(from_attributes=True)


class Rule42Patch(BaseModel):
    sail_num: Optional[str] = None
    penalty_number: Optional[str] = None
    race: Optional[str] = None
    group: Optional[str] = None
    rule: Optional[str] = None
    comp_action: Optional[str] = None
    description: Optional[str] = None
    class_name: Optional[str] = None
    date: Optional[date] = None


# =========================
# PROTESTS: listagem
# =========================
class ProtestPartySummary(BaseModel):
    sail_no: str | None = None
    boat_name: str | None = None
    class_name: str | None = None
    free_text: str | None = None


class ProtestInitiatorSummary(BaseModel):
    sail_no: str | None = None
    boat_name: str | None = None
    class_name: str | None = None
    party_text: str | None = None  # admin filing without entry


class ProtestListItem(BaseModel):
    id: int
    short_code: str
    type: str
    status: str
    race_date: str | None = None
    race_number: str | None = None
    group_name: str | None = None
    initiator: ProtestInitiatorSummary
    respondents: List[ProtestPartySummary]
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =========================
# PROTESTS: criação
# =========================
class ProtestRespondentIn(BaseModel):
    kind: Literal["entry", "other"] = "entry"
    entry_id: Optional[int] = None
    free_text: Optional[str] = None
    represented_by: Optional[str] = None


class ProtestValidityIn(BaseModel):
    informed_by_hailing: Optional[bool] = None
    hailing_words: Optional[str] = None
    hailing_when: Optional[datetime] = None
    red_flag: Optional[str] = None
    red_flag_when: Optional[datetime] = None
    informed_other_way: Optional[bool] = None
    informed_other_how_when_where: Optional[str] = None


class ProtestIncidentIn(BaseModel):
    when_where: Optional[str] = None
    description: Optional[str] = None
    rules_applied: Optional[str] = None
    damage_injury: Optional[str] = None
    witnesses: Optional[List[dict]] = None


class ProtestCreate(BaseModel):
    type: Literal["protest", "redress", "reopen", "support_person_report", "misconduct_rss69"]
    race_date: Optional[str] = None
    race_number: Optional[str] = None
    group_name: Optional[str] = None
    initiator_entry_id: Optional[int] = None
    initiator_party_text: Optional[str] = None
    initiator_represented_by: Optional[str] = None
    respondents: List[ProtestRespondentIn]
    validity: Optional[ProtestValidityIn] = None
    incident: Optional[ProtestIncidentIn] = None


# =========================
# PROTESTS: decisão (admin/júri)
# =========================
class ProtestDecisionIn(BaseModel):
    # campos de cabeçalho / contexto
    case_number: Optional[str] = None
    race_number: Optional[str] = None
    hearing_status: Optional[str] = None
    type: Optional[str] = None
    valid: Optional[bool] = None
    date_of_race: Optional[str] = None
    received_time: Optional[str] = None
    class_fleet: Optional[str] = None

    # participantes
    parties: List[str] = []
    witnesses: List[str] = []

    # conteúdo
    case_summary: Optional[str] = None
    procedural_matters: Optional[str] = None
    facts_found: Optional[str] = None
    conclusions_and_rules: Optional[str] = None
    decision_text: Optional[str] = None
    short_decision: Optional[str] = None

    # assinatura/fecho
    decision_date: Optional[str] = None
    decision_time: Optional[str] = None
    panel_chair: Optional[str] = None
    panel_members: List[str] = []


# =========================
# HEARINGS
# =========================
HearingStatusLiteral = Literal["OPEN", "CLOSED"]  # alinhado com a API


class HearingOut(BaseModel):
    id: int
    case_number: int
    race: str
    initiator: str
    respondent: str
    decision: Optional[str] = None
    sch_date: Optional[date] = None
    sch_time: Optional[time] = None
    room: Optional[str] = None
    status: HearingStatusLiteral
    model_config = ConfigDict(from_attributes=True)


class HearingPatch(BaseModel):
    decision: Optional[str] = None
    sch_date: Optional[date] = None
    sch_time: Optional[time] = None
    room: Optional[str] = None
    status: Optional[HearingStatusLiteral] = None


class ProtestDecisionTemplateOut(BaseModel):
    template: Dict


class ProtestDecisionOut(BaseModel):
    decision_pdf_url: str
    protest_id: int
    hearing_id: int
    status_after: str


# =========================
# PROTEST TIME LIMIT (PTL)
# =========================
class PTLBase(BaseModel):
    regatta_id: int
    class_name: str
    fleet: Optional[str] = None
    # "HH:MM" (aceita "H:MM" e normaliza)
    time_limit_hm: str
    date: date  # tipo nativo

    @field_validator("time_limit_hm")
    @classmethod
    def _valid_hhmm(cls, v: str) -> str:
        import re
        if not re.match(r"^\d{1,2}:\d{2}$", v or ""):
            raise ValueError("time_limit_hm deve ser HH:MM")
        h, m = v.split(":")
        h_i, m_i = int(h), int(m)
        if h_i < 0 or m_i < 0 or m_i > 59:
            raise ValueError("time_limit_hm is invalid (minutes must be 00–59)")
        return f"{h_i:02d}:{m_i:02d}"


class PTLCreate(PTLBase):
    pass


class PTLPatch(BaseModel):
    class_name: Optional[str] = None
    fleet: Optional[str] = None
    time_limit_hm: Optional[str] = None
    date: Optional[date] = None

    @field_validator("time_limit_hm")
    @classmethod
    def _valid_hhmm_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        import re
        if not re.match(r"^\d{1,2}:\d{2}$", v):
            raise ValueError("time_limit_hm deve ser HH:MM")
        h, m = v.split(":")
        h_i, m_i = int(h), int(m)
        if h_i < 0 or m_i < 0 or m_i > 59:
            raise ValueError("time_limit_hm is invalid (minutes must be 00–59)")
        return f"{h_i:02d}:{m_i:02d}"


class PTLRead(BaseModel):
    id: int
    regatta_id: int
    class_name: str
    fleet: Optional[str]
    time_limit_hm: str
    date: date

    model_config = ConfigDict(from_attributes=True)


# =========================
# ENTRY PATCH
# =========================
class EntryPatch(BaseModel):
    # boat
    class_name: Optional[str] = None
    boat_country: Optional[str] = None
    boat_country_code: Optional[str] = None
    sail_number: Optional[str] = None
    bow_number: Optional[str] = None
    boat_name: Optional[str] = None
    boat_model: Optional[str] = None
    rating: Optional[float] = None
    rating_type: Optional[str] = None
    orc_low: Optional[float] = None
    orc_medium: Optional[float] = None
    orc_high: Optional[float] = None
    category: Optional[str] = None

    # helm
    helm_position: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    helm_country: Optional[str] = None
    territory: Optional[str] = None
    club: Optional[str] = None
    email: Optional[str] = None
    contact_phone_1: Optional[str] = None
    contact_phone_2: Optional[str] = None
    address: Optional[str] = None
    zip_code: Optional[str] = None
    town: Optional[str] = None
    helm_country_secondary: Optional[str] = None
    federation_license: Optional[str] = None

    # owner (handicap)
    owner_first_name: Optional[str] = None
    owner_last_name: Optional[str] = None
    owner_email: Optional[str] = None

    # meta
    regatta_id: Optional[int] = None
    paid: Optional[bool] = None
    confirmed: Optional[bool] = None
    waiting_list: Optional[bool] = None

    crew_members: Optional[List[Dict[str, Any]]] = None

    @field_validator("boat_country_code", mode="before")
    @classmethod
    def _v_boat_country_code(cls, v):
        return _normalize_country_code(v)

    @field_validator("class_name", mode="before")
    @classmethod
    def _v_class_name(cls, v):
        return _normalize_optional_text(v, field_name="Class name", max_len=100)

    @field_validator("sail_number", mode="before")
    @classmethod
    def _v_sail_number(cls, v):
        return _normalize_optional_text(
            v,
            field_name="Sail number",
            max_len=_ENTRY_SAIL_NUMBER_MAX_LEN,
        )

    @field_validator(
        "boat_country",
        "bow_number",
        "boat_name",
        "boat_model",
        "category",
        "first_name",
        "last_name",
        "helm_country",
        "territory",
        "club",
        "address",
        "zip_code",
        "town",
        "helm_country_secondary",
        "federation_license",
        "owner_first_name",
        "owner_last_name",
        mode="before",
    )
    @classmethod
    def _v_optional_text_fields(cls, v, info):
        limits = {
            "boat_country": 100,
            "bow_number": 32,
            "boat_name": 120,
            "boat_model": 120,
            "category": 80,
            "first_name": 80,
            "last_name": 80,
            "helm_country": 100,
            "territory": 100,
            "club": 120,
            "address": 250,
            "zip_code": 20,
            "town": 100,
            "helm_country_secondary": 100,
            "federation_license": 64,
            "owner_first_name": 80,
            "owner_last_name": 80,
        }
        field = str(info.field_name)
        return _normalize_optional_text(v, field_name=field.replace("_", " ").title(), max_len=limits[field])

    @field_validator("email", "owner_email", mode="before")
    @classmethod
    def _v_emails(cls, v, info):
        field = "Owner email" if info.field_name == "owner_email" else "Email"
        return _normalize_optional_email(v, field_name=field)

    @field_validator("contact_phone_1", "contact_phone_2", mode="before")
    @classmethod
    def _v_phones(cls, v, info):
        field = "Contact phone 1" if info.field_name == "contact_phone_1" else "Contact phone 2"
        return _normalize_optional_phone(v, field_name=field)

    @field_validator("date_of_birth", mode="before")
    @classmethod
    def _v_date_of_birth(cls, v):
        return _normalize_optional_birth_date(v)

    @field_validator("gender", mode="before")
    @classmethod
    def _v_gender(cls, v):
        return _normalize_optional_gender(v)

    @field_validator("crew_members", mode="before")
    @classmethod
    def _v_crew_members(cls, v):
        return _normalize_crew_members(v)

    @field_validator("rating_type", mode="before")
    @classmethod
    def _v_rating_type(cls, v):
        return _normalize_rating_type(v)

    @field_validator("helm_position", mode="before")
    @classmethod
    def _v_helm_position(cls, v):
        return _normalize_helm_position(v)

    @field_validator("rating", "orc_low", "orc_medium", "orc_high", mode="before")
    @classmethod
    def _v_finite_rating(cls, v):
        return _validate_finite_rating(v)


# =========================
# SCORING ENQUIRIES
# =========================
ScoringStatusLiteral = Literal["submitted", "under_review", "answered", "closed", "invalid"]


class ScoringCreate(BaseModel):
    initiator_entry_id: int
    race_id: Optional[int] = None
    race_number: Optional[str] = None
    # estes dois podem ser preenchidos automaticamente no BE a partir da Entry
    class_name: Optional[str] = None
    sail_number: Optional[str] = None

    requested_change: Optional[str] = None
    requested_score: Optional[float] = None
    boat_ahead: Optional[str] = None
    boat_behind: Optional[str] = None
    # NOTA: 'response' não entra no Create (é dado pelo admin, mais tarde)


class ScoringRead(ScoringCreate):
    id: int
    regatta_id: int
    boat_country_code: Optional[str] = None
    status: ScoringStatusLiteral
    admin_note: Optional[str] = None
    decision_pdf_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    response: Optional[str] = None  # 👈 NOVO

    model_config = ConfigDict(from_attributes=True)


class ScoringPatch(BaseModel):
    # o admin pode ajustar estes campos
    race_id: Optional[int] = None
    race_number: Optional[str] = None
    class_name: Optional[str] = None
    sail_number: Optional[str] = None

    requested_change: Optional[str] = None
    requested_score: Optional[float] = None
    boat_ahead: Optional[str] = None
    boat_behind: Optional[str] = None

    status: Optional[ScoringStatusLiteral] = None
    admin_note: Optional[str] = None
    decision_pdf_path: Optional[str] = None

    response: Optional[str] = None  # 👈 NOVO


# =========================
# REQUESTS
# =========================
class RequestCreate(BaseModel):
    initiator_entry_id: int
    request_text: str


class RequestPatch(BaseModel):
    status: Optional[str] = None          # submitted | under_review | closed (admin)
    admin_response: Optional[str] = None  # admin
    request_text: Optional[str] = None    # opcional permitir editar se ainda submitted (sailor)


class RequestRead(BaseModel):
    id: int
    regatta_id: int
    request_no: int
    initiator_entry_id: Optional[int] = None

    class_name: Optional[str] = None
    sail_number: Optional[str] = None
    sailor_name: Optional[str] = None

    request_text: str
    status: str
    admin_response: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =========================
# QUESTIONS
# =========================
QuestionStatus = Literal["open", "answered", "closed"]
QuestionVisibility = Literal["public", "private"]


class QuestionBase(BaseModel):
    class_name: str
    sail_number: str
    sailor_name: str
    subject: str
    body: str


class QuestionCreate(QuestionBase):
    visibility: QuestionVisibility = "private"


class QuestionUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    visibility: Optional[QuestionVisibility] = None
    status: Optional[QuestionStatus] = None
    answer_text: Optional[str] = None


class QuestionRead(BaseModel):
    id: int
    regatta_id: int
    seq_no: int
    class_name: str
    sail_number: str
    sailor_name: str
    subject: str
    body: str
    status: QuestionStatus
    visibility: QuestionVisibility
    answer_text: Optional[str]
    answered_by: Optional[int]
    answered_at: Optional[datetime]
    created_by: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


# =========================
# ENTRY ATTACHMENTS
# =========================
class EntryAttachmentRead(BaseModel):
    id: int
    entry_id: int
    title: str
    url: Optional[str] = None
    content_type: str
    size_bytes: int
    visible_to_sailor: bool
    uploaded_by_name: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EntryAttachmentPatch(BaseModel):
    title: Optional[str] = None
    visible_to_sailor: Optional[bool] = None


class ListAttachmentsResponse(BaseModel):
    attachments: List[EntryAttachmentRead]
    timezone: Optional[str] = None


class ClassSettingsRead(BaseModel):
    regatta_id: int
    class_name: str
    discard_count: Optional[int] = None
    discard_threshold: Optional[int] = None
    scoring_codes: Optional[Dict[str, float]] = None
    model_config = ConfigDict(from_attributes=True)

class ClassSettingsResolved(BaseModel):
    # valores efetivamente em uso (override se existir, senão global)
    discard_count: int
    discard_threshold: int
    scoring_codes: Dict[str, float]

class ClassSettingsUpdate(BaseModel):
    discard_count: Optional[int] = None  # enviar null para “limpar” override
    discard_threshold: Optional[int] = None
    scoring_codes: Optional[Dict[str, float]] = None



# app/schemas/fleets.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

class FleetRead(BaseModel):
    id: int
    name: str
    order_index: Optional[int] = None
    class Config: from_attributes = True

class FleetAssignmentRead(BaseModel):
    entry_id: int
    fleet_id: int
    class Config: from_attributes = True

class FleetSetRead(BaseModel):
    id: int
    regatta_id: int
    class_name: str
    phase: str
    label: Optional[str] = None

    is_published: bool
    public_title: Optional[str] = None
    published_at: Optional[datetime] = None

    fleets: List[FleetRead] = []

    class Config:
        from_attributes = True

class CreateQualifyingSetIn(BaseModel):
    label: Optional[str] = None
    num_fleets: int = Field(ge=2, le=4)
    race_ids: List[int] = Field(default_factory=list)

class ReshuffleIn(BaseModel):
    label: Optional[str] = None
    num_fleets: int = Field(ge=2, le=4)
    race_ids: List[int] = Field(default_factory=list)

class FinalsRangeIn(BaseModel):
    name: str
    from_rank: int = Field(ge=1)
    to_rank: int = Field(ge=1)

class StartFinalsIn(BaseModel):
    label: Optional[str] = "Finals"
    grouping: Optional[Dict[str, int]] = None
    ranges: Optional[List[FinalsRangeIn]] = None
    race_ids: List[int] = Field(default_factory=list)

class MedalRaceAssignSchema(BaseModel):
    class_name: str
    from_rank: int
    to_rank: int
    race_ids: List[int] = Field(default_factory=list)  # ✅ agora é opcional

DiscardScope = Literal["all", "first", "last", "range", "manual"]


class DiscardRule(BaseModel):
    scope: DiscardScope

    # quantos descartes esta regra dá
    discard_count: int = Field(ge=0, default=0)

    # aplica só se existirem >= threshold races dentro do scope (opcional)
    threshold: Optional[int] = Field(default=None, ge=0)

    # first/last
    n: Optional[int] = Field(default=None, ge=0)

    # range (1-based, em ordem das races)
    from_index: Optional[int] = Field(default=None, ge=1)
    to_index: Optional[int] = Field(default=None, ge=1)

    # manual
    race_ids: Optional[List[int]] = None

class ClassSettingsPatch(BaseModel):
    discard_count: Optional[int] = None
    discard_threshold: Optional[int] = None
    scoring_codes: Optional[dict[str, float]] = None

    # ✅ NOVO
    discard_rules: Optional[List[DiscardRule]] = None
