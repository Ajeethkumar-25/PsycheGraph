from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List
from datetime import datetime, date
from .models import UserRole


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenRefresh(BaseModel):
    refresh_token: str


class TokenData(BaseModel):
    email: Optional[str] = None


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole
    is_active: Optional[bool] = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserCreate(UserBase):
    password: str
    organization_id: int


class DoctorBasic(BaseModel):
    id: int
    full_name: Optional[str] = None


    class Config:
        from_attributes = True


class UserOut(UserBase):
    id: int
    organization_id: Optional[int] = None
    phone_number: Optional[str] = None

    class Config:
        from_attributes = True

class DoctorOut(UserOut):
    pass


class ReceptionistOut(UserOut):
    shift_timing: Optional[str] = None
    assigned_doctors: Optional[List[DoctorBasic]] = None

    @model_validator(mode="before")
    @classmethod
    def populate_assigned_doctors(cls, data):
        if hasattr(data, "receptionist_profile") and data.receptionist_profile:
            doctors = data.receptionist_profile.doctors
            if doctors:
                data.__dict__["assigned_doctors"] = [
                    {"id": d.id, "full_name": d.full_name}
                    for d in doctors
                ]
        return data

    class Config:
        from_attributes = True


class UserWithToken(UserOut):
    access_token: str
    refresh_token: str
    token_type: str


# -------------------------------------------------------------------
# Registration Schemas
# -------------------------------------------------------------------

class HospitalRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone_number: Optional[str] = None
    license_key: str  


class DoctorRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class ReceptionistRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    shift_timing: str
    assigned_doctor_user_ids: Optional[List[int]] = []


class RegisterResponse(BaseModel):
    message: str
    user_id: int
    organization_id: int


class OrganizationBase(BaseModel):
    name: str
    license_key: Optional[str] = None


class OrganizationCreate(BaseModel):
    name: str
    email: EmailStr
    license_key: str


class OrganizationOut(OrganizationBase):
    id: int
    name: str
    email: Optional[str] = None
    license_key: Optional[str] = None
    is_approved: Optional[bool] = False
    is_active: bool
    logo_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class PatientBase(BaseModel):
    full_name: str
    date_of_birth: Optional[date] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None

    @field_validator('date_of_birth', mode='before')
    @classmethod
    def parse_date_of_birth(cls, v):
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.date()
        return v


class PatientCreate(PatientBase):
    organization_id: Optional[int] = None
    


class PatientOut(PatientBase):
    id: int
    organization_id: Optional[int]
    doctor_id: Optional[int]
    age: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class SessionBase(BaseModel):
    patient_id: int
    doctor_id: int
    date: datetime


class SOAPNote(BaseModel):
    subjective:  Optional[str] = None    # Patient's symptoms, complaints, history
    objective:   Optional[str] = None    # Doctor's observations, vitals, exam findings
    assessment:  Optional[str] = None    # Diagnosis / clinical impression
    plan:        Optional[str] = None    # Treatment plan, medications, follow-up


class SessionCreate(BaseModel):
    patient_id:     int
    doctor_id:      int
    appointment_id: Optional[int] = None
    soap_notes:     Optional[SOAPNote] = None


class SessionOut(SessionBase):
    id: int
    appointment_id: Optional[int] = None
    soap_notes:     Optional[SOAPNote] = None
    summary:        Optional[str] = None
    transcript:     Optional[str] = None
    version:        int

    @field_validator("soap_notes", mode="before")
    @classmethod
    def parse_soap_notes(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except Exception:
                return None
        return v

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    organization_id: Optional[int] = None
    password: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    license_key: Optional[str] = None
    is_active: Optional[bool] = None


class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    doctor_id: Optional[int] = None


class AvailabilityBase(BaseModel):
    start_time: datetime
    end_time: datetime


class AvailabilityCreate(AvailabilityBase):
    doctor_id: int
    organization_id: Optional[int] = None


class AvailabilityBatchCreate(BaseModel):
    doctor_id: int
    organization_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    duration_minutes: int = 30


class AvailabilityOut(AvailabilityBase):
    id: int
    doctor_id: int
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    booked_by_role: Optional[str] = None
    organization_id: int
    is_booked: bool

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class AppointmentBase(BaseModel):
    patient_id: int
    doctor_id: int
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None
    meet_link: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    availability_id: int
    patient_age: Optional[int] = None


class AppointmentOut(AppointmentBase):
    id: int
    status: str
    organization_id: int
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    booked_by_role: Optional[str] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    meet_link: Optional[str] = None


class AppointmentReschedule(BaseModel):
    new_availability_id: int


class SessionUpdate(BaseModel):
    transcript: Optional[str] = None
    soap_notes: Optional[SOAPNote] = None
    summary: Optional[str] = None

class DaySchedule(BaseModel):
    is_enabled:  bool = True
    start_time:  Optional[str] = None
    end_time:    Optional[str] = None
    break_start: Optional[str] = None
    break_end:   Optional[str] = None

    @field_validator("start_time", "end_time", "break_start", "break_end", mode="before")
    @classmethod
    def validate_time_format(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            import re
            if not re.match(r"^\d{2}:\d{2}$", v):
                raise ValueError("Time must be in HH:MM format e.g. 09:00")
        return v

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "is_enabled": True,
                "start_time": "09:00",
                "end_time": "17:00",
                "break_start": "12:00",
                "break_end": "13:00"
            }
        }


class WorkingHoursUpdate(BaseModel):
    monday:    Optional[DaySchedule] = None
    tuesday:   Optional[DaySchedule] = None
    wednesday: Optional[DaySchedule] = None
    thursday:  Optional[DaySchedule] = None
    friday:    Optional[DaySchedule] = None
    saturday:  Optional[DaySchedule] = None
    sunday:    Optional[DaySchedule] = None

    class Config:
        json_schema_extra = {
            "example": {
                "monday":    {"is_enabled": True,  "start_time": "09:00", "end_time": "17:00", "break_start": "12:00", "break_end": "13:00"},
                "tuesday":   {"is_enabled": True,  "start_time": "09:00", "end_time": "17:00", "break_start": "12:00", "break_end": "13:00"},
                "wednesday": {"is_enabled": True,  "start_time": "09:00", "end_time": "17:00", "break_start": "12:00", "break_end": "13:00"},
                "thursday":  {"is_enabled": True,  "start_time": "09:00", "end_time": "17:00", "break_start": "12:00", "break_end": "13:00"},
                "friday":    {"is_enabled": True,  "start_time": "09:00", "end_time": "16:00", "break_start": "12:00", "break_end": "13:00"},
                "saturday":  {"is_enabled": True,  "start_time": "10:00", "end_time": "14:00", "break_start": None,    "break_end": None},
                "sunday":    {"is_enabled": False, "start_time": None,    "end_time": None,    "break_start": None,    "break_end": None}
            }
        }


class ScheduleOut(BaseModel):
    id:          int
    day:         str
    is_enabled:  bool
    start_time:  Optional[str] = None
    end_time:    Optional[str] = None
    break_start: Optional[str] = None
    break_end:   Optional[str] = None

    class Config:
        from_attributes = True

class HospitalProfileOut(BaseModel):
    org_name:     str
    email:        str
    logo_url:     Optional[str] = None
    address:      Optional[str] = None
    full_name:    Optional[str] = None
    phone_number: Optional[str] = None

    class Config:
        from_attributes = True