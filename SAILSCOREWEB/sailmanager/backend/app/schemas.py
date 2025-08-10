from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, date

# ---------- NOTICE ----------
class NoticeOut(BaseModel):
    id: int
    filename: str
    filepath: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

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
    description: Optional[str] = None
    poster_url: Optional[str] = None
    notice_board_url: Optional[str] = None
    entry_list_url: Optional[str] = None
    online_entry_url: Optional[str] = None

class RegattaRead(RegattaCreate):
    id: int

    class Config:
        from_attributes = True

# ---------- REGATTA CLASS ✅ NOVO ----------
class RegattaClassCreate(BaseModel):
    regatta_id: int
    class_name: str

class RegattaClassRead(BaseModel):
    id: int
    regatta_id: int
    class_name: str

    class Config:
        from_attributes = True

# ---------- ENTRY ----------
class EntryCreate(BaseModel):
    # Boat data
    class_name: str
    boat_country: Optional[str]
    sail_number: Optional[str]
    boat_name: Optional[str]
    category: Optional[str]

    # Helm data
    date_of_birth: Optional[str]
    gender: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    helm_country: Optional[str]
    territory: Optional[str]
    club: Optional[str]
    email: Optional[str]
    contact_phone_1: Optional[str]
    contact_phone_2: Optional[str]
    address: Optional[str]
    zip_code: Optional[str]
    town: Optional[str]
    helm_country_secondary: Optional[str]

    regatta_id: int
    user_id: int
    paid: Optional[bool] = False

class EntryRead(EntryCreate):
    id: int

    class Config:
        from_attributes = True

# ---------- RESULT ----------
class ResultCreate(BaseModel):
    regatta_id: int
    race_id: int
    sail_number: Optional[str]
    boat_name: Optional[str]
    boat_class: Optional[str]
    helm_name: Optional[str]
    position: int
    points: float

class ResultRead(BaseModel):
    id: int
    regatta_id: int
    race_id: int
    sail_number: Optional[str]
    boat_name: Optional[str]
    boat_class: Optional[str] = Field(..., alias="class_name")
    helm_name: Optional[str] = Field(..., alias="skipper_name")
    position: int
    points: float

    class Config:
        from_attributes = True
        allow_population_by_field_name = True



        # ---------- RACE dos results----------

class RaceCreate(BaseModel):
    name: str
    regatta_id: int
    date: Optional[str] = None         # <- era date; agora str opcional para bater com o modelo
    class_name: str

class RaceRead(BaseModel):
    id: int
    name: str
    regatta_id: int
    date: Optional[str] = None         # <- TORNAR OPCIONAL
    class_name: str

    class Config:
        from_attributes = True         # (Pydantic v2)  |  use orm_mode=True p/ v1
        # orm_mode = True


