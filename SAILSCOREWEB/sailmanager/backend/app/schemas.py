# app/schemas.py
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List,  Dict
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


class UserLogin(BaseModel):
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
    # dados do barco
    class_name: str
    boat_country: Optional[str] = None
    sail_number: Optional[str] = None
    boat_name: Optional[str] = None
    category: Optional[str] = None

    # dados do timoneiro
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
    user_id: int
    paid: Optional[bool] = False


class EntryRead(EntryCreate):
    id: int

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------- RESULT ----------
class ResultCreate(BaseModel):
    regatta_id: int
    race_id: int
    sail_number: Optional[str] = None
    boat_name: Optional[str] = None
    boat_class: Optional[str] = None   # opcional para evitar 422; backend usa Race.class_name
    helm_name: Optional[str] = None
    position: int
    points: float
    code: Optional[str] = None          # <- NOVO



class ResultRead(BaseModel):
    id: int
    regatta_id: int
    race_id: int
    sail_number: Optional[str] = None
    boat_name: Optional[str] = None
    class_name: Optional[str] = None      # <- coincide com ApiResult do front
    skipper_name: Optional[str] = None    # <- coincide com ApiResult do front
    position: int
    points: float
    code: Optional[str] = None  # <- ADICIONA

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------- RACE ----------
class RaceCreate(BaseModel):
    name: str
    regatta_id: int
    date: Optional[str] = None
    class_name: str


class RaceRead(BaseModel):
    id: int
    name: str
    regatta_id: int
    date: Optional[str] = None
    class_name: str

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
