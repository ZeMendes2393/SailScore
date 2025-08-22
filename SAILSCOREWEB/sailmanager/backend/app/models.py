from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Boolean, Float,
    UniqueConstraint, Index, JSON
)
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
    name = Column(String, index=True)
    location = Column(String)
    start_date = Column(String)
    end_date = Column(String)

    # Campos opcionais
    description = Column(String, nullable=True)
    poster_url = Column(String, nullable=True)
    notice_board_url = Column(String, nullable=True)
    entry_list_url = Column(String, nullable=True)
    online_entry_url = Column(String, nullable=True)

    # Regras de descarte (admin configura)
    
    discard_count = Column(Integer, nullable=False, default=0)
    discard_threshold = Column(Integer, nullable=False, default=4)
    
    entries = relationship("Entry", back_populates="regatta", cascade="all, delete-orphan")
    results = relationship("Result", back_populates="regatta", cascade="all, delete-orphan")
    races = relationship("Race", back_populates="regatta", cascade="all, delete-orphan")
    classes = relationship("RegattaClass", back_populates="regatta", cascade="all, delete-orphan")
    scoring_codes = Column(JSON, nullable=True, default=dict)  # ex: {"DNF": 10, "DNC": 15}


class RegattaClass(Base):
    __tablename__ = "regatta_classes"
    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), index=True)
    class_name = Column(String, index=True)

    regatta = relationship("Regatta", back_populates="classes")

    __table_args__ = (
        UniqueConstraint("regatta_id", "class_name", name="uq_regatta_class"),
    )


class Entry(Base):
    __tablename__ = "entries"
    id = Column(Integer, primary_key=True, index=True)

    # Boat data
    class_name = Column(String, index=True)
    boat_country = Column(String)
    sail_number = Column(String, index=True)
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

    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    paid = Column(Boolean, default=False)

    regatta = relationship("Regatta", back_populates="entries")
    user = relationship("User", back_populates="entries")

    __table_args__ = (
        Index("ix_entries_regatta_class", "regatta_id", "class_name"),
    )


class Notice(Base):
    __tablename__ = "notices"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), index=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    title = Column(String, nullable=False)


class Race(Base):
    __tablename__ = "races"
    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    date = Column(String, nullable=True)
    class_name = Column(String, nullable=False, index=True)  # obrigatório

    regatta = relationship("Regatta", back_populates="races")
    results = relationship("Result", back_populates="race", cascade="all, delete-orphan")

    __table_args__ = (
        # Evita duas “R1 (49er)” na mesma regata/classe
        UniqueConstraint("regatta_id", "class_name", "name", name="uq_race_regatta_class_name"),
        Index("ix_races_regatta_class", "regatta_id", "class_name"),
    )


class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False, index=True)
    race_id = Column(Integer, ForeignKey("races.id", ondelete="CASCADE"), nullable=False, index=True)
    sail_number = Column(String, nullable=True, index=True)
    boat_name = Column(String, nullable=True)
    class_name = Column(String, nullable=False, index=True)  # vem da Race, portanto obrigatório
    skipper_name = Column(String, nullable=True)
    position = Column(Integer, nullable=False)
    points = Column(Float, nullable=False)

    regatta = relationship("Regatta", back_populates="results")
    race = relationship("Race", back_populates="results")
    code = Column(String, nullable=True)  # "DNF" | "DNC" | etc.

    __table_args__ = (
        Index("ix_results_regatta_race_position", "regatta_id", "race_id", "position"),
        Index("ix_results_regatta_class", "regatta_id", "class_name"),
    )
