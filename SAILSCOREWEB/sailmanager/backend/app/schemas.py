# app/schemas.py
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List,  Dict, Literal
from datetime import datetime



# ---------- NOTICE ----------
class NoticeOut(BaseModel):
    id: int
    filename: str
    filepath: str
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------- AUTH ----------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str





class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- REGATTA ----------
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
    discard_count: int = 0          # quantos descartes aplicar
    discard_threshold: int = 4       # a partir de quantas regatas começa a descartar


class RegattaRead(RegattaCreate):
    id: int
    scoring_codes: Optional[Dict[str, float]] = None  # <- ADICIONA
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------- REGATTA CLASS ----------
class RegattaClassCreate(BaseModel):
    regatta_id: int
    class_name: str


class RegattaClassRead(BaseModel):
    id: int
    regatta_id: int
    class_name: str

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------- ENTRY ----------
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

# ---------- RACE ----------
class RaceCreate(BaseModel):
    name: str
    regatta_id: int
    date: Optional[str] = None
    class_name: str
    order_index: Optional[int] = None  # << opcional; se None, backend define ao fim

class RaceUpdate(BaseModel):  # << NOVO
    name: Optional[str] = None
    date: Optional[str] = None
    order_index: Optional[int] = None

class RacesReorder(BaseModel):  # << NOVO
    ordered_ids: List[int]

class RaceRead(BaseModel):
    id: int
    name: str
    regatta_id: int
    date: Optional[str] = None
    class_name: str
    order_index: int  # << NOVO
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)














    

# … (Notice, Auth UserCreate/Login/Token mantêm)

# ---------- INVITATIONS ----------
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
    password: Optional[str] = None  # para criar password se quiseres

# ---------- SAILOR PROFILE ----------
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









# ---------- PROTESTS (Listagem + criação) ----------
from typing import Optional, List, Literal
from datetime import datetime
from pydantic import BaseModel, ConfigDict

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


class ProtestRespondentIn(BaseModel):
    kind: Literal['entry', 'other'] = 'entry'   # mais seguro que str solto
    entry_id: Optional[int] = None
    free_text: Optional[str] = None
    represented_by: Optional[str] = None


class ProtestValidityIn(BaseModel):
    informed_by_hailing: Optional[bool] = None
    hailing_words: Optional[str] = None
    hailing_when: Optional[datetime] = None
    red_flag: Optional[str] = None         # not_required | yes | no
    red_flag_when: Optional[datetime] = None
    informed_other_way: Optional[bool] = None
    informed_other_how_when_where: Optional[str] = None


class ProtestIncidentIn(BaseModel):
    when_where: Optional[str] = None
    description: Optional[str] = None
    rules_applied: Optional[str] = None
    damage_injury: Optional[str] = None
    witnesses: Optional[List[dict]] = None  # simplificado para já


class ProtestCreate(BaseModel):
    type: Literal['protest','redress','reopen','support_person_report','misconduct_rss69']
    race_date: Optional[str] = None
    race_number: Optional[str] = None
    group_name: Optional[str] = None
    initiator_entry_id: int
    initiator_represented_by: Optional[str] = None
    respondents: List[ProtestRespondentIn]
    validity: Optional[ProtestValidityIn] = None
    incident: Optional[ProtestIncidentIn] = None











class UserLogin(BaseModel):
    email: EmailStr
    password: str
    regatta_id: Optional[int] = None  # <-- só usado para regatistas


# ---------- REGATTA UPDATE ----------
class RegattaUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    # opcionais
    description: Optional[str] = None
    poster_url: Optional[str] = None
    notice_board_url: Optional[str] = None
    entry_list_url: Optional[str] = None
    online_entry_url: Optional[str] = None


class RegattaClassesReplace(BaseModel):
    classes: List[str]  # lista final de classes para a regata (substitui tudo)



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
    classes: List[str]  # nomes (ex.: ["49er","ILCA 7"])

    model_config = ConfigDict(from_attributes=True)




