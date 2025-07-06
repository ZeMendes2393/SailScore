from pydantic import BaseModel, EmailStr
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class NoticeOut(BaseModel):
    id: int
    filename: str
    filepath: str
    uploaded_at: datetime

    class Config:
        orm_mode = True

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
        orm_mode = True

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
