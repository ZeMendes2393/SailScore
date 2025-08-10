from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
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

    # Campos opcionais
    description = Column(String, nullable=True)
    poster_url = Column(String, nullable=True)
    notice_board_url = Column(String, nullable=True)
    entry_list_url = Column(String, nullable=True)
    online_entry_url = Column(String, nullable=True)

    entries = relationship("Entry", back_populates="regatta")
    results = relationship("Result", back_populates="regatta")
    races = relationship("Race", back_populates="regatta")
    classes = relationship("RegattaClass", back_populates="regatta", cascade="all, delete")  # ✅ AQUI


class RegattaClass(Base):
    __tablename__ = "regatta_classes"
    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id"))
    class_name = Column(String)

    regatta = relationship("Regatta", back_populates="classes")


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
    paid = Column(Boolean, default=False)

    regatta = relationship("Regatta", back_populates="entries")
    user = relationship("User", back_populates="entries")


class Notice(Base):
    __tablename__ = "notices"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    regatta_id = Column(Integer, ForeignKey("regattas.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    title = Column(String, nullable=False)


class Race(Base):
    __tablename__ = "races"
    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id"), nullable=False)
    name = Column(String, nullable=False)
    date = Column(String, nullable=True)

    class_name = Column(String, nullable=False)  # ✅ NOVO campo

    regatta = relationship("Regatta", back_populates="races")
    results = relationship("Result", back_populates="race")

class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id"), nullable=False)
    race_id = Column(Integer, ForeignKey("races.id"), nullable=False)
    sail_number = Column(String, nullable=True)
    boat_name = Column(String, nullable=True)
    class_name = Column(String, nullable=True)
    skipper_name = Column(String, nullable=True)
    position = Column(Integer, nullable=False)
    points = Column(Float, nullable=False)

    regatta = relationship("Regatta", back_populates="results")
    race = relationship("Race", back_populates="results")
