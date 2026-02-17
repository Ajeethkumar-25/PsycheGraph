from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey, DateTime, Text, Enum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
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
    CANCELLED = "CANCELLED"

# -------------------------------------------------------------------
# Models
# -------------------------------------------------------------------

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    license_key = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    patients = relationship("Patient", back_populates="organization", cascade="all, delete-orphan")

class User(Base):
    """
    Central Identity Table.
    Stores authentication & role data.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True) # Nullable for Super Admin
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="users")
    
    # Self-referential relationship for 'created_by'
    created_users = relationship("User", back_populates="created_by_user", remote_side=[id])
    created_by_user = relationship("User", back_populates="created_users", foreign_keys=[created_by_id])

    # Role Profiles
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False, cascade="all, delete-orphan", foreign_keys="[Doctor.user_id]")
    receptionist_profile = relationship("Receptionist", back_populates="user", uselist=False, cascade="all, delete-orphan", foreign_keys="[Receptionist.user_id]")

    @property
    def specialization(self):
        if self.doctor_profile:
            return self.doctor_profile.specialization
        if self.receptionist_profile:
            # Receptionist doesn't have specialization in new model? checking...
            # I forgot to add specialization to Receptionist in previous step!
            # The previous 'legacy' model had it. Check router logic.
            # router says: extra_fields.get("specialization") for receptionist.
            # So Receptionist SHOULD have specialization.
            return self.receptionist_profile.specialization if hasattr(self.receptionist_profile, 'specialization') else None
        return None

    @property
    def license_key(self): 
        if self.doctor_profile:
            return self.doctor_profile.license_key
        # If Receptionist, return None (or maybe linked doctor's? No, license is personal)
        # However, UserOut expects it.
        return None

    @property
    def shift_timing(self):
        if self.receptionist_profile:
            return self.receptionist_profile.shift_timing
        return None

    @property
    def doctor_id(self):
        # Return the Doctor ID if this user is a doctor
        if self.doctor_profile:
            return self.doctor_profile.id
        # For Receptionist, return the assigned doctor's ID
        if self.receptionist_profile:
            return self.receptionist_profile.doctor_id
        return None

    @property
    def full_name(self):
        if self.doctor_profile:
            return self.doctor_profile.full_name
        if self.receptionist_profile:
            return self.receptionist_profile.full_name
        return self.email # Fallback for Admins/Hospital users
    
    @property
    def doctor_name(self):
        if self.receptionist_profile and self.receptionist_profile.doctor:
            return self.receptionist_profile.doctor.full_name
        return None
    
    # Audit relationships
    created_patients = relationship("Patient", back_populates="created_by_user", foreign_keys="[Patient.created_by_id]")
    created_appointments = relationship("Appointment", back_populates="created_by_user", foreign_keys="[Appointment.created_by_id]")
    created_availabilities = relationship("Availability", back_populates="created_by_user", foreign_keys="[Availability.created_by_id]")
    created_sessions = relationship("Session", back_populates="created_by_user", foreign_keys="[Session.created_by_id]")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False, index=True)
    license_key = Column(String, nullable=False) # Professional Medical License
    specialization = Column(String, nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="doctor_profile", foreign_keys=[user_id])
    created_by_user = relationship("User", foreign_keys=[created_by_id])
    
    patients = relationship("Patient", back_populates="doctor")
    availabilities = relationship("Availability", back_populates="doctor", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="doctor")
    sessions = relationship("Session", back_populates="doctor")
    receptionists = relationship("Receptionist", back_populates="doctor")


class Receptionist(Base):
    __tablename__ = "receptionists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=True) # Added for consistency
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True, index=True) # Linked doctor
    specialization = Column(String, nullable=True)
    shift_timing = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="receptionist_profile", foreign_keys=[user_id])
    doctor = relationship("Doctor", back_populates="receptionists")



class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    full_name = Column(String, nullable=False, index=True)
    date_of_birth = Column(DateTime, nullable=True)
    gender = Column(String, nullable=True)
    phone = Column(String, nullable=True, index=True)
    email = Column(String, nullable=True, index=True)
    address = Column(String, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="patients")
    doctor = relationship("Doctor", back_populates="patients")
    created_by_user = relationship("User", back_populates="created_patients", foreign_keys=[created_by_id])
    
    @property
    def contact_number(self):
        return self.phone

    @contact_number.setter
    def contact_number(self, value):
        self.phone = value
    
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="patient", cascade="all, delete-orphan")


class Availability(Base):
    __tablename__ = "availabilities"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    is_booked = Column(Boolean, default=False, nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Constraints
    __table_args__ = (
        UniqueConstraint('doctor_id', 'start_time', name='uq_doctor_start_time'),
        Index('idx_doctor_start', 'doctor_id', 'start_time'),
    )

    # Relationships
    doctor = relationship("Doctor", back_populates="availabilities")
    created_by_user = relationship("User", back_populates="created_availabilities", foreign_keys=[created_by_id])
    appointment = relationship("Appointment", back_populates="availability", uselist=False)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    availability_id = Column(Integer, ForeignKey("availabilities.id"), unique=True, nullable=False)
    appointment_date = Column(DateTime(timezone=True), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.SCHEDULED, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    meet_link = Column(String, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    availability = relationship("Availability", back_populates="appointment")
    created_by_user = relationship("User", back_populates="created_appointments", foreign_keys=[created_by_id])
    session = relationship("Session", back_populates="appointment", uselist=False)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True, unique=True)
    audio_url = Column(String, nullable=True)
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    soap_notes = Column(Text, nullable=True)
    session_date = Column(DateTime(timezone=True), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    patient = relationship("Patient", back_populates="sessions")
    doctor = relationship("Doctor", back_populates="sessions")
    appointment = relationship("Appointment", back_populates="session")
    created_by_user = relationship("User", back_populates="created_sessions", foreign_keys=[created_by_id])

    @property
    def date(self):
        return self.session_date
    
    @property
    def soap_note(self):
        return self.soap_notes