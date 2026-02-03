# app/models.py — imports
from datetime import datetime, timedelta
from enum import Enum  # Enum do Python (para declarar membros)

from sqlalchemy import (
    Column, Integer, String, DateTime, Date, Time, ForeignKey, Boolean, Float,
    UniqueConstraint, Index, JSON, Text, Table,  # <-- adiciona Table aqui
    Enum as SAEnum,                              # <-- Enum do SQLAlchemy
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import BigInteger  # <-- adiciona

from app.database import Base



import sqlalchemy as sa
from sqlalchemy import orm





#        USERS
# =========================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=True)
    role = Column(String)  # "admin" | "regatista" (no MVP)
    is_active = Column(Boolean, default=True, nullable=False)
    email_verified_at = Column(DateTime, nullable=True)

    entries = relationship("Entry", back_populates="user")
    sailor_profile = relationship(
        "SailorProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )


# =========================
#        REGATTAS
# =========================
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
    online_entry_open = Column(Boolean, nullable=False, server_default="1")  # default True

    # Regras de descarte
    discard_count = Column(Integer, nullable=False, default=0)
    discard_threshold = Column(Integer, nullable=False, default=4)

    entries = relationship("Entry", back_populates="regatta", cascade="all, delete-orphan")
    results = relationship("Result", back_populates="regatta", cascade="all, delete-orphan")
    races = relationship("Race", back_populates="regatta", cascade="all, delete-orphan")
    classes = relationship("RegattaClass", back_populates="regatta", cascade="all, delete-orphan")

    # Pontuações para códigos (ex.: {"DNF": 10, "DNC": 15})
    scoring_codes = Column(JSON, nullable=True, default=dict)


# =========================
#   ENUMS (Notice)
# =========================
class NoticeSource(str, Enum):
    ORGANIZING_AUTHORITY = "ORGANIZING_AUTHORITY"
    RACE_COMMITTEE = "RACE_COMMITTEE"
    JURY = "JURY"
    TECHNICAL_COMMITTEE = "TECHNICAL_COMMITTEE"
    OTHER = "OTHER"


class NoticeDocType(str, Enum):
    RACE_DOCUMENT = "RACE_DOCUMENT"
    RULE_42 = "RULE_42"
    JURY_DOC = "JURY_DOC"
    TECHNICAL = "TECHNICAL"
    OTHER = "OTHER"


# =========================
#   REGATTA CLASSES
# =========================
class RegattaClass(Base):
    __tablename__ = "regatta_classes"
    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False, index=True)
    class_name = Column(String, nullable=False, index=True)

    regatta = relationship("Regatta", back_populates="classes")

    # ligação inversa para notices (many-to-many)
    notices = relationship(
        "Notice",
        secondary=lambda: notice_classes,
        back_populates="classes"
    )

    __table_args__ = (
        UniqueConstraint("regatta_id", "class_name", name="uq_regatta_class"),
    )


# =========================
#        ENTRIES
# =========================
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
    confirmed = Column(Boolean, default=False, nullable=False)

    regatta = relationship("Regatta", back_populates="entries")
    user = relationship("User", back_populates="entries")

    __table_args__ = (
        Index("ix_entries_regatta_class", "regatta_id", "class_name"),
    )


# =========================
#   NOTICE ⟷ CLASS (M2M)
# =========================
notice_classes = Table(
    "notice_classes",
    Base.metadata,
    Column("notice_id", Integer, ForeignKey("notices.id", ondelete="CASCADE"), primary_key=True),
    Column("regatta_class_id", Integer, ForeignKey("regatta_classes.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_notice_classes_notice", "notice_id"),
    Index("ix_notice_classes_regatta_class", "regatta_class_id"),
)


# =========================
#         NOTICES
# =========================
class Notice(Base):
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    title = Column(String, nullable=False)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False, index=True)

    # NOVOS CAMPOS
    published_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )
    source = Column(
        SAEnum(NoticeSource, native_enum=False, name="notice_source"),
        nullable=False,
        server_default=NoticeSource.OTHER.value
    )
    doc_type = Column(
        SAEnum(NoticeDocType, native_enum=False, name="notice_doc_type"),
        nullable=False,
        server_default=NoticeDocType.RACE_DOCUMENT.value
    )
    is_important = Column(Boolean, nullable=False, server_default="0")

    # “All Classes” sem duplicação
    applies_to_all = Column(Boolean, nullable=False, server_default="1")

    # Relações
    classes = relationship(
        "RegattaClass",
        secondary=notice_classes,
        back_populates="notices",
        cascade="all"
    )

    __table_args__ = (
        Index("ix_notices_regatta_published", "regatta_id", "published_at"),
    )


# =========================
#          RACES
# =========================
class Race(Base):
    __tablename__ = "races"
    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    date = Column(String, nullable=True)
    class_name = Column(String, nullable=False, index=True)
    order_index = Column(Integer, nullable=False, default=0, index=True)  # ajuda no overall e ordenação
    is_medal_race = Column(Boolean, default=False)
    double_points = Column(Boolean, default=False)
    discardable = Column(Boolean, default=True)

    regatta = relationship("Regatta", back_populates="races")
    results = relationship("Result", back_populates="race", cascade="all, delete-orphan")
    fleet_set_id = Column(Integer, ForeignKey("fleet_sets.id", ondelete="SET NULL"), nullable=True, index=True)
    fleet_set = relationship("FleetSet", back_populates="races")

    __table_args__ = (
        UniqueConstraint("regatta_id", "class_name", "name", name="uq_race_regatta_class_name"),
        Index("ix_races_regatta_class", "regatta_id", "class_name"),
        Index("ix_races_regatta_order", "regatta_id", "order_index"),
    )


# =========================
#         RESULTS
# =========================
class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False, index=True)
    race_id = Column(Integer, ForeignKey("races.id", ondelete="CASCADE"), nullable=False, index=True)
    sail_number = Column(String, nullable=True, index=True)
    boat_name = Column(String, nullable=True)
    class_name = Column(String, nullable=False, index=True)
    skipper_name = Column(String, nullable=True)
    position = Column(Integer, nullable=False)
    points = Column(Float, nullable=False)
    code = Column(String, nullable=True)  # "DNF" | "DNC" | etc.

    regatta = relationship("Regatta", back_populates="results")
    race = relationship("Race", back_populates="results")

    __table_args__ = (
        Index("ix_results_regatta_race_position", "regatta_id", "race_id", "position"),
        Index("ix_results_regatta_class", "regatta_id", "class_name"),
    )


# =========================
#     SAILOR PROFILE
# =========================
class SailorProfile(Base):
    __tablename__ = "sailor_profiles"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    first_name = Column(String)
    last_name = Column(String)
    date_of_birth = Column(String)
    gender = Column(String)
    club = Column(String)
    contact_phone_1 = Column(String)
    contact_phone_2 = Column(String)
    address = Column(String)
    zip_code = Column(String)
    town = Column(String)
    country = Column(String)
    country_secondary = Column(String)
    territory = Column(String)

    user = relationship("User", back_populates="sailor_profile")


# =========================
#       INVITATIONS
# =========================
class Invitation(Base):
    __tablename__ = "invitations"
    id = Column(Integer, primary_key=True)
    email = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False)  # "admin" | "regatista"
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow() + timedelta(days=7))
    accepted_at = Column(DateTime, nullable=True)


# =========================
#         PROTESTS
# =========================
class Protest(Base):
    __tablename__ = "protests"

    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), index=True)

    # tipo e identificação da prova
    type = Column(String, nullable=False)  # protest | redress | reopen | support_person_report | misconduct_rss69
    race_date = Column(String, nullable=True)
    race_number = Column(String, nullable=True)
    group_name = Column(String, nullable=True)

    # iniciador
    initiator_entry_id = Column(Integer, ForeignKey("entries.id", ondelete="SET NULL"), nullable=True, index=True)
    initiator_represented_by = Column(String, nullable=True)

    # Incident (detalhes)
    incident_when_where = Column(Text, nullable=True)
    incident_description = Column(Text, nullable=True)
    rules_alleged = Column(Text, nullable=True)

    # sistema
    status = Column(
        String,
        nullable=False,
        default="submitted"
    )  # submitted | under_review | scheduled | decided | closed | invalid | withdrawn
    received_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # ---- snapshots & pdfs ----
    submitted_snapshot_json = Column(JSON, nullable=True)
    submitted_pdf_url = Column(String(500), nullable=True)

    decision_json = Column(JSON, nullable=True)
    decision_pdf_url = Column(String(500), nullable=True)
    decided_at = Column(DateTime, nullable=True)

    decided_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_by = relationship("User", foreign_keys=[decided_by_user_id])

    # relationships
    initiator_entry = relationship("Entry", foreign_keys=[initiator_entry_id])

    # parties (respondentes)
    parties = relationship(
        "ProtestParty",
        back_populates="protest",
        cascade="all, delete-orphan"
    )

    # anexos
    attachments = relationship(
        "ProtestAttachment",
        back_populates="protest",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_protests_regatta_updated", "regatta_id", "updated_at"),
    )


class ProtestAttachment(Base):
    __tablename__ = "protest_attachments"

    id = Column(Integer, primary_key=True, index=True)
    protest_id = Column(Integer, ForeignKey("protests.id", ondelete="CASCADE"), index=True, nullable=False)

    # 'submitted_pdf' | 'decision_pdf' | 'admin_upload' (exemplos)
    kind = Column(String(50), nullable=False)

    filename = Column(String(300), nullable=False)
    content_type = Column(String(120), nullable=True)
    size = Column(Integer, nullable=False, default=0)

    # URL público (ou interno) do ficheiro
    url = Column(String(500), nullable=False)

    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # relações
    protest = relationship("Protest", back_populates="attachments")
    uploaded_by = relationship("User")


class ProtestParty(Base):
    """
    Respondentes / partes envolvidas (1:N por Protest).
    kind = 'entry' (liga a entries) | 'other' (texto livre)
    """
    __tablename__ = "protest_parties"

    id = Column(Integer, primary_key=True, index=True)
    protest_id = Column(Integer, ForeignKey("protests.id", ondelete="CASCADE"), index=True)

    kind = Column(String, nullable=False, default="entry")  # entry | other
    entry_id = Column(Integer, ForeignKey("entries.id", ondelete="SET NULL"), nullable=True, index=True)
    free_text = Column(String, nullable=True)
    represented_by = Column(String, nullable=True)

    protest = relationship("Protest", back_populates="parties")
    entry = relationship("Entry")  # quando kind = 'entry'

    __table_args__ = (
        Index("ix_protest_parties_protest", "protest_id"),
    )


class Rule42Record(Base):
    __tablename__ = "rule42_records"

    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, index=True, nullable=False)

    sail_num = Column(String(64), nullable=False)
    penalty_number = Column(String(64), nullable=False)   # nº da penalidade
    race = Column(String(64), nullable=False)              # ex.: "R1", "2", "Final A"
    group = Column(String(64), nullable=True)              # ex.: "Group A"

    rule = Column(String(64), nullable=False, default="RRS 42")
    comp_action = Column(String(128), nullable=True)       # ex.: "retired", "DSQ"
    description = Column(Text, nullable=True)

    class_name = Column(String(64), nullable=False)
    date = Column(Date, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# --- Hearings / Decisions ---
class Hearing(Base):
    __tablename__ = "hearings"

    id = Column(Integer, primary_key=True)
    regatta_id = Column(Integer, index=True, nullable=False)

    # Se quiseres FK real (só se o teu schema já tem a tabela e ligações):
    # protest_id = Column(Integer, ForeignKey("protests.id", ondelete="CASCADE"), index=True, nullable=False)
    protest_id = Column(Integer, index=True, nullable=False)

    case_number = Column(Integer, nullable=False)   # único por regata (ver __table_args__)

    # scheduling
    sch_date = Column(Date, nullable=True)
    sch_time = Column(Time, nullable=True)          # tipo correto
    room = Column(String(128), nullable=True)

    # decisão “clássica” (texto livre, opcional)
    decision = Column(Text, nullable=True)

    # NOVO: campos usados nas rotas de decisão
    decision_snapshot_json = Column(JSON, nullable=True)
    decision_pdf_url = Column(String(500), nullable=True)
    decision_at = Column(DateTime, nullable=True)
    panel_chair = Column(String(200), nullable=True)
    panel_members = Column(JSON, nullable=True)  # lista de nomes

    status = Column(String(32), nullable=False, default="SCHEDULED")  # SCHEDULED | ONGOING | CLOSED

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("regatta_id", "case_number", name="uq_hearing_case_per_regatta"),
    )


# =========================
#   Protest Time Limits
# =========================
class ProtestTimeLimit(Base):
    __tablename__ = "protest_time_limits"

    id = Column(Integer, primary_key=True)
    regatta_id = Column(Integer, nullable=False, index=True)
    class_name = Column(String(100), nullable=False)
    fleet = Column(String(50), nullable=True)

    # ✅ agora guardamos "HH:MM"
    time_limit_hm = Column(String(5), nullable=False, default="00:00")  # ex.: "01:30"

    date = Column(Date, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("regatta_id", "class_name", "fleet", "date", name="uq_ptl_regatta_class_fleet_date"),
    )


# =========================
# SCORING ENQUIRIES
# =========================


class ScoringEnquiry(Base):
    __tablename__ = "scoring_enquiries"

    id = Column(Integer, primary_key=True, index=True)

    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False, index=True)
    initiator_entry_id = Column(Integer, ForeignKey("entries.id", ondelete="SET NULL"), nullable=True, index=True)

    # alvo (identificação do que está a ser questionado)
    race_id = Column(Integer, ForeignKey("races.id", ondelete="SET NULL"), nullable=True, index=True)
    race_number = Column(String, nullable=True)
    class_name = Column(String, nullable=True, index=True)
    sail_number = Column(String, nullable=True, index=True)

    # conteúdo (atualizado)
    requested_change = Column(String, nullable=True)
    requested_score  = Column(Float, nullable=True)
    boat_ahead       = Column(String, nullable=True)
    boat_behind      = Column(String, nullable=True)

    # estado & meta
    status = Column(String, default="submitted", nullable=False, index=True)  # submitted|under_review|answered|closed|invalid
    admin_note = Column(String, nullable=True)
    decision_pdf_path = Column(String, nullable=True)
    response = Column(String, nullable=True)  # ou Text se preferires

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # relations
    regatta = relationship("Regatta")
    initiator_entry = relationship("Entry")
    race = relationship("Race")

    __table_args__ = (
        Index("ix_scoring_regatta_status", "regatta_id", "status"),
    )




# =========================
# REGATTA COUNTERS (sequências por regata)
# =========================
class RegattaCounter(Base):
    __tablename__ = "regatta_counters"
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), primary_key=True)
    request_seq = Column(Integer, default=0, nullable=False)

# =========================
# REQUESTS
# =========================
class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), index=True, nullable=False)
    initiator_entry_id = Column(Integer, ForeignKey("entries.id", ondelete="SET NULL"), nullable=True, index=True)

    # snapshot do sailor
    class_name = Column(String, nullable=True, index=True)
    sail_number = Column(String, nullable=True, index=True)
    sailor_name = Column(String, nullable=True)  # "First Last"

    # conteúdo
    request_text = Column(String, nullable=False)

    # fluxo
    status = Column(String, default="submitted", index=True)  # submitted | under_review | closed
    admin_response = Column(String, nullable=True)

    # numeração por regata
    request_no = Column(Integer, nullable=False, index=True)  # 1,2,3… por regatta_id

    # timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    regatta = relationship("Regatta")
    initiator_entry = relationship("Entry")


# --- Questions (Enums + Modelo) ---

class QuestionStatus(str, Enum):
    open = "open"
    answered = "answered"
    closed = "closed"

class QuestionVisibility(str, Enum):
    public = "public"
    private = "private"





class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True)
    regatta_id = Column(Integer, ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False)

    # numeração sequencial por regata
    seq_no = Column(Integer, nullable=False)  # Q#

    class_name = Column(String(80), nullable=False)
    sail_number = Column(String(40), nullable=False)
    sailor_name = Column(String(160), nullable=False)

    subject = Column(String(160), nullable=False)
    body = Column(Text, nullable=False)

    # usar SAEnum explicitamente para não colidir com enum.Enum do Python
    status = Column(
        SAEnum(QuestionStatus, name="questionstatus"),
        nullable=False,
        default=QuestionStatus.open,
    )
    visibility = Column(
        SAEnum(QuestionVisibility, name="questionvisibility"),
        nullable=False,
        default=QuestionVisibility.private,
    )

    answer_text = Column(Text, nullable=True)
    answered_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    answered_at = Column(DateTime(timezone=True), nullable=True)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("regatta_id", "seq_no", name="uq_questions_regatta_seq"),
        Index("ix_questions_regatta_status", "regatta_id", "status"),
        Index("ix_questions_regatta_visibility", "regatta_id", "visibility"),
    )



class EntryAttachment(Base):
    __tablename__ = "entry_attachments"
    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("entries.id", ondelete="CASCADE"), nullable=False, index=True)

    # metadados
    title = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False, default="application/pdf")
    size_bytes = Column(BigInteger, nullable=False, default=0)
    visible_to_sailor = Column(Boolean, nullable=False, default=True)

    # ficheiros (local storage)
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)  # caminho do disco (ex.: "uploads/entry_attachments/123/uuid.pdf")
    public_path = Column(String(512), nullable=False)    # caminho público (ex.: "/uploads/entry_attachments/123/uuid.pdf")

    uploaded_by_id = Column(Integer, nullable=True)
    uploaded_by_name = Column(String(255), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)

    entry = relationship("Entry", backref="attachments")


# app/models.py (excerto do RegattaClassSettings)

class RegattaClassSettings(Base):
    __tablename__ = "regatta_class_settings"

    id = sa.Column(sa.Integer, primary_key=True)

    regatta_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("regattas.id", ondelete="CASCADE"),
        nullable=False,
    )
    class_name = sa.Column(sa.String(255), nullable=False)

    # overrides antigos
    discard_count = sa.Column(sa.Integer, nullable=True)
    discard_threshold = sa.Column(sa.Integer, nullable=True)
    scoring_codes = sa.Column(sa.JSON, nullable=True)

    # ✅ antigos (ficam, mas vamos deixar de usar)
    discard_rules = sa.Column(sa.JSON, nullable=True)
    discard_rules_active = sa.Column(sa.Boolean, nullable=False, default=True)
    discard_rules_label = sa.Column(sa.String(120), nullable=True)

    # ✅ NOVO MODO STANDARD (schedule)
    # ex: [0,0,0,1,1,1,2,2,2]
    discard_schedule = sa.Column(sa.JSON, nullable=True)
    discard_schedule_active = sa.Column(sa.Boolean, nullable=False, default=False)
    discard_schedule_label = sa.Column(sa.String(120), nullable=True)

    __table_args__ = (
        sa.UniqueConstraint(
            "regatta_id",
            "class_name",
            name="uq_regatta_class_settings_regatta_class",
        ),
    )

    regatta = orm.relationship(
        "Regatta",
        backref=orm.backref("class_settings", cascade="all, delete-orphan"),
    )


class FleetSet(Base):
    __tablename__ = "fleet_sets"

    id = sa.Column(sa.Integer, primary_key=True)
    regatta_id = sa.Column(sa.Integer, sa.ForeignKey("regattas.id", ondelete="CASCADE"), nullable=False, index=True)
    class_name = sa.Column(sa.String(255), nullable=False, index=True)
    phase = sa.Column(sa.String(32), nullable=False)  # 'qualifying' | 'finals'
    label = sa.Column(sa.String(255), nullable=True)
    created_at = sa.Column(sa.DateTime, server_default=sa.func.now(), nullable=False)

    # 🔥 NOVOS CAMPOS
    is_published = sa.Column(
        sa.Boolean,
        nullable=False,
        default=False,
        server_default=sa.text("0"),  # ✅ para SQLite
    )
    public_title = sa.Column(sa.String(255), nullable=True)
    published_at = sa.Column(sa.DateTime, nullable=True)

    # RELATIONS
    races = relationship("Race", back_populates="fleet_set")
    regatta = relationship("Regatta")
    fleets = relationship("Fleet", cascade="all, delete-orphan", back_populates="fleet_set")
    assignments = relationship("FleetAssignment", cascade="all, delete-orphan", back_populates="fleet_set")

class Fleet(Base):
    __tablename__ = "fleets"
    id = sa.Column(sa.Integer, primary_key=True)
    fleet_set_id = sa.Column(sa.Integer, sa.ForeignKey("fleet_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    name = sa.Column(sa.String(64), nullable=False)
    order_index = sa.Column(sa.Integer, nullable=True)

    fleet_set = relationship("FleetSet", back_populates="fleets")
    assignments = relationship("FleetAssignment", cascade="all, delete-orphan", back_populates="fleet")

class FleetAssignment(Base):
    __tablename__ = "fleet_assignments"
    id = sa.Column(sa.Integer, primary_key=True)
    fleet_set_id = sa.Column(sa.Integer, sa.ForeignKey("fleet_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    fleet_id = sa.Column(sa.Integer, sa.ForeignKey("fleets.id", ondelete="CASCADE"), nullable=False, index=True)
    entry_id = sa.Column(sa.Integer, sa.ForeignKey("entries.id", ondelete="CASCADE"), nullable=False, index=True)

    fleet_set = relationship("FleetSet", back_populates="assignments")
    fleet = relationship("Fleet")
