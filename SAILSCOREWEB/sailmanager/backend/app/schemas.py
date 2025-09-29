# app/schemas.py
from __future__ import annotations

from typing import Optional, List, Dict, Literal
from datetime import datetime, date, time
from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
# =========================
# AUTH
# =========================
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    regatta_id: Optional[int] = None  # usado por regatistas, opcional


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# =========================
# REGATTAS
# =========================
class RegattaCreate(BaseModel):
    name: str
    location: str
    start_date: str
    end_date: str

    # opcionais
    description: Optional[str] = None
    poster_url: Optional[str] = None
    notice_board_url: Optional[str] = None
    entry_list_url: Optional[str] = None
    online_entry_url: Optional[str] = None

    # scoring / descartes
    discard_count: int = 0
    discard_threshold: int = 4


class RegattaRead(RegattaCreate):
    id: int
    scoring_codes: Optional[Dict[str, float]] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class RegattaUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    description: Optional[str] = None
    poster_url: Optional[str] = None
    notice_board_url: Optional[str] = None
    entry_list_url: Optional[str] = None
    online_entry_url: Optional[str] = None


class RegattaClassesReplace(BaseModel):
    classes: List[str]


# =========================
# REGATTA CLASSES
# =========================
class RegattaClassCreate(BaseModel):
    regatta_id: int
    class_name: str


class RegattaClassRead(BaseModel):
    id: int
    regatta_id: int
    class_name: str
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =========================
# ENTRIES
# =========================
class EntryCreate(BaseModel):
    # boat
    class_name: str
    boat_country: Optional[str] = None
    sail_number: Optional[str] = None
    boat_name: Optional[str] = None
    category: Optional[str] = None

    # helm
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

    regatta_id: int
    paid: Optional[bool] = False


class EntryRead(EntryCreate):
    id: int
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =========================
# RACES
# =========================
class RaceCreate(BaseModel):
    name: str
    regatta_id: int
    date: Optional[str] = None
    class_name: str
    order_index: Optional[int] = None  # se None, backend coloca no fim


class RaceUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    order_index: Optional[int] = None


class RacesReorder(BaseModel):
    ordered_ids: List[int]


class RaceRead(BaseModel):
    id: int
    name: str
    regatta_id: int
    date: Optional[str] = None
    class_name: str
    order_index: int
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =========================
# RESULTS
# =========================
class ResultCreate(BaseModel):
    regatta_id: int
    race_id: int
    sail_number: Optional[str] = None
    boat_name: Optional[str] = None
    boat_class: Optional[str] = None
    helm_name: Optional[str] = None
    position: int
    points: float
    code: Optional[str] = None


class ResultRead(BaseModel):
    id: int
    regatta_id: int
    race_id: int
    sail_number: Optional[str] = None
    boat_name: Optional[str] = None
    class_name: Optional[str] = None
    skipper_name: Optional[str] = None
    position: int
    points: float
    code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


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
    initiator_entry_id: int
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

# app/schemas.py (adiciona num bloco novo, p.ex. após Rule42)

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
            raise ValueError("time_limit_hm inválido (minutos 00–59)")
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
            raise ValueError("time_limit_hm inválido (minutos 00–59)")
        return f"{h_i:02d}:{m_i:02d}"


class PTLRead(BaseModel):
    id: int
    regatta_id: int
    class_name: str
    fleet: Optional[str]
    time_limit_hm: str
    date: date

    model_config = ConfigDict(from_attributes=True)