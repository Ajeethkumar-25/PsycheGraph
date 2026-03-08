from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey, DateTime, Text, Enum,
    UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import enum 
from .database import Base


# -------------------------------------------------------------------
# Enums
# -------------------------------------------------------------------

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    HOSPITAL = "HOSPITAL"
    DOCTOR = "DOCTOR"
    RECEPTIONIST = "RECEPTIONIST"


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    RESCHEDULED = "RESCHEDULED"
    CANCELLED = "CANCELLED"


# -------------------------------------------------------------------
# Organization
# -------------------------------------------------------------------

class Organization(Base):
    __tablename__ = "organizations"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, unique=True, index=True, nullable=False)
    email       = Column(String, nullable=False, index=True)
    license_key = Column(String, unique=True, nullable=False, index=True)
    is_approved = Column(Boolean, default=False, nullable=False, index=True)
    is_active   = Column(Boolean, default=True,  nullable=False, index=True)
    address     = Column(String, nullable=True)
    logo_url    = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    users    = relationship("User",    back_populates="organization", cascade="all, delete-orphan")
    patients = relationship("Patient", back_populates="organization", cascade="all, delete-orphan")
    schedules = relationship("OrganizationSchedule", back_populates="organization", cascade="all, delete-orphan")

# -------------------------------------------------------------------
# OrganizationSchedule  (weekly working hours — one row per day)
# -------------------------------------------------------------------

class OrganizationSchedule(Base):
    __tablename__ = "organization_schedules"

    id              = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    day             = Column(String, nullable=False)   # "monday" .. "sunday"
    is_enabled      = Column(Boolean, default=True, nullable=False)
    start_time      = Column(String, nullable=True)    # "09:00"
    end_time        = Column(String, nullable=True)    # "17:00"
    break_start     = Column(String, nullable=True)    # "12:00"
    break_end       = Column(String, nullable=True)    # "13:00"

    organization = relationship("Organization", back_populates="schedules")


# -------------------------------------------------------------------
# User  (central identity table)
# -------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(Enum(UserRole), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    created_by_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    is_active       = Column(Boolean, default=True, nullable=False)

    # Shared profile fields
    full_name    = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)

    # Receptionist-specific fields
    


    # -------------------------------------------------------------------
    # Relationships
    # -------------------------------------------------------------------

    organization = relationship("Organization", back_populates="users")

    # Self-referential for 'created_by'
    created_users   = relationship("User", back_populates="created_by_user", remote_side=[id])
    created_by_user = relationship("User", back_populates="created_users", foreign_keys=[created_by_id])

    # Role profile relationships (one-to-one)
    doctor_profile = relationship(
        "Doctor", back_populates="user",
        uselist=False, cascade="all, delete-orphan",
        foreign_keys="[Doctor.user_id]"
    )
    receptionist_profile = relationship(
        "Receptionist", back_populates="user",
        uselist=False, cascade="all, delete-orphan",
        foreign_keys="[Receptionist.user_id]"
    )

    # Audit relationships
    created_patients       = relationship("Patient",      back_populates="created_by_user",        foreign_keys="[Patient.created_by_id]")
    created_appointments   = relationship("Appointment",  back_populates="created_by_user",        foreign_keys="[Appointment.created_by_id]")
    created_availabilities = relationship("Availability", back_populates="created_by_user",        foreign_keys="[Availability.created_by_id]")
    created_sessions       = relationship("Session",      back_populates="created_by_user",        foreign_keys="[Session.created_by_id]")

    # Doctor role relationships (only meaningful when role == DOCTOR)
    patients           = relationship("Patient",      back_populates="doctor",        foreign_keys="[Patient.doctor_id]")
    availabilities     = relationship("Availability", back_populates="doctor",        foreign_keys="[Availability.doctor_id]", cascade="all, delete-orphan")
    appointments       = relationship("Appointment",  back_populates="doctor",        foreign_keys="[Appointment.doctor_id]")
    sessions_as_doctor = relationship("Session",      back_populates="doctor",        foreign_keys="[Session.doctor_id]")

    # -------------------------------------------------------------------
    # Convenience properties
    # -------------------------------------------------------------------

    @property
    def doctor_id(self):
        """
        For DOCTOR      → the Doctor profile row's PK.
        For RECEPTIONIST → first linked Doctor row's PK (legacy compat).
        """
        if self.role == UserRole.DOCTOR:
            return self.doctor_profile.id if self.doctor_profile else None
        if self.role == UserRole.RECEPTIONIST and self.receptionist_profile:
            docs = self.receptionist_profile.doctors
            return docs[0].id if docs else None
        return None

    @property
    def doctor_name(self):
        """Returns full_name of the first linked doctor (receptionist helper)."""
        if self.receptionist_profile:
            docs = self.receptionist_profile.doctors
            return docs[0].full_name if docs else None
        return None


# -------------------------------------------------------------------
# Doctor  (profile table — one row per DOCTOR user)
# -------------------------------------------------------------------

class Doctor(Base):
    __tablename__ = "doctors"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    full_name      = Column(String, nullable=False, index=True)
    created_by_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user            = relationship("User", back_populates="doctor_profile",  foreign_keys=[user_id])
    created_by_user = relationship("User",                                    foreign_keys=[created_by_id])

    patients       = relationship("Patient",      primaryjoin="Doctor.user_id == foreign(Patient.doctor_id)",       foreign_keys="[Patient.doctor_id]",       viewonly=True)
    availabilities = relationship("Availability", primaryjoin="Doctor.user_id == foreign(Availability.doctor_id)", foreign_keys="[Availability.doctor_id]", viewonly=True)
    appointments   = relationship("Appointment",  primaryjoin="Doctor.user_id == foreign(Appointment.doctor_id)",  foreign_keys="[Appointment.doctor_id]",  viewonly=True)
    sessions       = relationship("Session",      primaryjoin="Doctor.user_id == foreign(Session.doctor_id)",      foreign_keys="[Session.doctor_id]",      viewonly=True)



# -------------------------------------------------------------------
# Receptionist  (profile table — one row per RECEPTIONIST user)
# -------------------------------------------------------------------

class Receptionist(Base):
    __tablename__ = "receptionists"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    full_name      = Column(String, nullable=True)
    # Stores the user_id values of linked doctors — mirrors User.doctor_ids
    # so the relationship below can resolve Doctor rows without a join table.
    doctor_ids     = Column(ARRAY(Integer), nullable=True, default=list)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="receptionist_profile", foreign_keys=[user_id])

    # Resolves linked Doctor profile rows directly from doctor_ids array.
    # appointments.py uses: selectinload(models.Receptionist.doctors)
    # then: [d.id for d in receptionist_profile.doctors]
    doctors = relationship(
        "Doctor",
        primaryjoin="any_(Receptionist.doctor_ids) == foreign(Doctor.user_id)",
        foreign_keys="[Doctor.user_id]",
        viewonly=True
    )


# -------------------------------------------------------------------
# Patient
# -------------------------------------------------------------------

class Patient(Base):
    __tablename__ = "patients"

    id              = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    doctor_id       = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    full_name       = Column(String, nullable=False, index=True)
    date_of_birth   = Column(DateTime, nullable=True)
    gender          = Column(String, nullable=True)
    phone           = Column(String, nullable=True, index=True)
    email           = Column(String, nullable=True, index=True)
    address         = Column(String, nullable=True)
    created_by_id   = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    is_active       = Column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    organization    = relationship("Organization", back_populates="patients")
    doctor          = relationship("User", back_populates="patients",         foreign_keys=[doctor_id])
    created_by_user = relationship("User", back_populates="created_patients", foreign_keys=[created_by_id])

    # Back-ref to Doctor profile row (used in patients.py doctor lookup)
    doctor_profile = relationship(
        "Doctor",
        primaryjoin="Patient.doctor_id == Doctor.user_id",
        foreign_keys=[doctor_id],
        viewonly=True
    )

    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    sessions     = relationship("Session",     back_populates="patient", cascade="all, delete-orphan")

    @property
    def contact_number(self):
        return self.phone

    @contact_number.setter
    def contact_number(self, value):
        self.phone = value

    @property
    def age(self):
        if not self.date_of_birth:
            return None
        today = datetime.now().date()
        dob = self.date_of_birth.date() if isinstance(self.date_of_birth, datetime) else self.date_of_birth
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


# -------------------------------------------------------------------
# Availability
# -------------------------------------------------------------------

class Availability(Base):
    __tablename__ = "availabilities"

    id              = Column(Integer, primary_key=True, index=True)
    doctor_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    start_time      = Column(DateTime(timezone=True), nullable=False)
    end_time        = Column(DateTime(timezone=True), nullable=False)
    is_booked       = Column(Boolean, default=False, nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('doctor_id', 'start_time', name='uq_doctor_start_time'),
        Index('idx_doctor_start',  'doctor_id', 'start_time'),
        Index('idx_org_booked',    'organization_id', 'is_booked'),
        Index('idx_doctor_booked', 'doctor_id', 'is_booked'),
    )

    # Relationships
    doctor          = relationship("User", back_populates="availabilities",         foreign_keys=[doctor_id])
    created_by_user = relationship("User", back_populates="created_availabilities", foreign_keys=[created_by_id])
    appointment     = relationship("Appointment", back_populates="availability", uselist=False)

    # Back-ref to Doctor profile row
    doctor_profile = relationship(
        "Doctor",
        primaryjoin="Availability.doctor_id == Doctor.user_id",
        foreign_keys=[doctor_id],
        viewonly=True
    )


# -------------------------------------------------------------------
# Appointment
# -------------------------------------------------------------------

class Appointment(Base):
    __tablename__ = "appointments"

    id               = Column(Integer,primary_key=True,index=True)
    patient_id       = Column(Integer,ForeignKey("patients.id"),nullable=False,index=True)
    doctor_id        = Column(Integer,ForeignKey("users.id"),nullable=False,index=True)
    availability_id  = Column(Integer,ForeignKey("availabilities.id"), unique=True,nullable=False)
    appointment_date = Column(DateTime(timezone=True), nullable=False, index=True)
    organization_id  = Column(Integer,ForeignKey("organizations.id"),nullable=False,index=True)
    start_time       = Column(DateTime(timezone=True),nullable=False)
    end_time         = Column(DateTime(timezone=True),nullable=False)
    status           = Column(Enum(AppointmentStatus),default=AppointmentStatus.SCHEDULED, nullable=False, index=True)
    notes            = Column(Text,nullable=True)
    meet_link        = Column(String,nullable=True)
    created_by_id    = Column(Integer,ForeignKey("users.id"),nullable=True)
    created_at       = Column(DateTime(timezone=True),server_default=func.now())

    # Denormalized fields
    patient_name   = Column(String,nullable=True)
    doctor_name    = Column(String,nullable=True)
    patient_age    = Column(Integer,nullable=True)
    booked_by_role = Column(String,nullable=True)

    __table_args__ = (
        Index('idx_apt_doctor_status','doctor_id','status'),
        Index('idx_apt_org_status','organization_id','status'),
        Index('idx_apt_patient_status', 'patient_id','status'),
        Index('idx_apt_date_status','appointment_date','status'),
    )

    # Relationships
    patient         = relationship("Patient",back_populates="appointments")
    doctor          = relationship("User",back_populates="appointments",foreign_keys=[doctor_id])
    availability    = relationship("Availability",back_populates="appointment")
    created_by_user = relationship("User",back_populates="created_appointments",foreign_keys=[created_by_id])
    session         = relationship("Session",back_populates="appointment",uselist=False)

    # Back-ref to Doctor profile row
    doctor_profile = relationship(
        "Doctor",
        primaryjoin="Appointment.doctor_id == Doctor.user_id",
        foreign_keys=[doctor_id],
        viewonly=True
    )


# -------------------------------------------------------------------
# Session
# -------------------------------------------------------------------

class Session(Base):
    __tablename__ = "sessions"

    id             = Column(Integer, primary_key=True, index=True)
    patient_id     = Column(Integer, ForeignKey("patients.id"),     nullable=False, index=True)
    doctor_id      = Column(Integer, ForeignKey("users.id"),        nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True, unique=True, index=True)
    audio_url      = Column(String, nullable=True)
    transcript     = Column(Text,   nullable=True)
    summary        = Column(Text,   nullable=True)
    soap_notes     = Column(Text,   nullable=True)
    session_date   = Column(DateTime(timezone=True), nullable=False, index=True)
    version        = Column(Integer, default=1, nullable=False)
    created_by_id  = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at     = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at     = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    patient         = relationship("Patient",     back_populates="sessions")
    doctor          = relationship("User",        back_populates="sessions_as_doctor", foreign_keys=[doctor_id])
    appointment     = relationship("Appointment", back_populates="session")
    created_by_user = relationship("User",        back_populates="created_sessions",   foreign_keys=[created_by_id])

    # Back-ref to Doctor profile row
    doctor_profile = relationship(
        "Doctor",
        primaryjoin="Session.doctor_id == Doctor.user_id",
        foreign_keys=[doctor_id],
        viewonly=True
    )

    @property
    def soap_note(self):
        return self.soap_notes

    @soap_note.setter
    def soap_note(self, value):
        self.soap_notes = value

    @property
    def date(self):
        return self.session_date

    @date.setter
    def date(self, value):
        self.session_date = value