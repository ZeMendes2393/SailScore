from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)

    entries = relationship("Entry", back_populates="user")

class Regatta(Base):
    __tablename__ = "regattas"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    location = Column(String)
    start_date = Column(String)
    end_date = Column(String)

    # Novos campos opcionais
    description = Column(String, nullable=True)
    poster_url = Column(String, nullable=True)
    notice_board_url = Column(String, nullable=True)
    entry_list_url = Column(String, nullable=True)
    online_entry_url = Column(String, nullable=True)

    entries = relationship("Entry", back_populates="regatta")

class Entry(Base):
    __tablename__ = "entries"
    id = Column(Integer, primary_key=True, index=True)

    # Boat data
    class_name = Column(String)
    boat_country = Column(String)
    sail_number = Column(String)
    boat_name = Column(String)
    category = Column(String)

    # Helm data
    date_of_birth = Column(String)
    gender = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    helm_country = Column(String)
    territory = Column(String)
    club = Column(String)
    email = Column(String)
    contact_phone_1 = Column(String)
    contact_phone_2 = Column(String)
    address = Column(String)
    zip_code = Column(String)
    town = Column(String)
    helm_country_secondary = Column(String)

    regatta_id = Column(Integer, ForeignKey("regattas.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

    regatta = relationship("Regatta", back_populates="entries")
    user = relationship("User", back_populates="entries")

class Notice(Base):
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    regatta_id = Column(Integer, ForeignKey("regattas.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    title = Column(String, nullable=False)  # ✅ novo campo
