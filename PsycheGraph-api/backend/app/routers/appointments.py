from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from .. import models, schemas, dependencies, database
from ..database import AsyncSessionLocal
from sqlalchemy import text
from datetime import datetime, timedelta, timezone
from ..services.google_calendar import GoogleCalendarService
from ..services.email import send_meet_link_email
import asyncio
import traceback
import psycopg2
import os
import threading
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor()

IST = timezone(timedelta(hours=5, minutes=30))

_calendar_service = None

def get_calendar_service():
    global _calendar_service
    if _calendar_service is None:
        try:
            _calendar_service = GoogleCalendarService()
            print("[GOOGLE] Calendar service initialized successfully")
        except Exception as e:
            print(f"[WARNING] Google Calendar not available: {e}")
            return None
    return _calendar_service


router = APIRouter(prefix="/appointments", tags=["Appointments"])


def save_meet_link_sync(appointment_id: int, meet_link: str):
    """Pure sync function to save meet link — runs in a thread, no event loop needed."""
    
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            database="psychedb",
            user="psycheuser",
            password="password"
        )
        cur = conn.cursor()
        cur.execute("UPDATE appointments SET meet_link = %s WHERE id = %s", (meet_link, appointment_id))
        conn.commit()
        cur.close()
        conn.close()
        print(f"[MEET LINK] Saved for appointment {appointment_id}: {meet_link}")
    except Exception as e:
        print(f"[MEET LINK] Failed to save for appointment {appointment_id}: {e}")
        print(traceback.format_exc())

def generate_meet_link_sync(
    appointment_id: int,
    summary: str,
    start_time_utc: datetime,
    end_time_utc: datetime,
    patient_email: Optional[str],
    doctor_email: Optional[str],
    patient_name: str,
    doctor_name: str,
    appointment_date: str,
    start_time_str: str,
    end_time_str: str,
    appointment_start_utc: datetime,
):
    """
    Fully synchronous background function — runs in a thread.
    No async, no event loop — avoids all deadlock issues.
    """
    print(f"[MEET LINK] Starting for appointment {appointment_id}")

    # Step 1: Generate meet link
    meet_link = None
    try:
        service = get_calendar_service()
        if service:
            meet_link = service.create_event(
                summary=summary,
                start_time=start_time_utc,
                end_time=end_time_utc,
                attendee_email=None
            )
    except Exception as e:
        print(f"[MEET LINK] Failed to create event for appointment {appointment_id}: {e}")
        print(traceback.format_exc())

    if not meet_link:
        print(f"[MEET LINK] No link generated for appointment {appointment_id}")
        return

    # Step 2: Save to DB
    save_meet_link_sync(appointment_id, meet_link)

    try:
        fireflies_api_key = os.environ.get("FIREFLIES_API_KEY", "")
        if fireflies_api_key:
            import requests
            query = """
            mutation AddToLiveMeeting($url: String!, $title: String) {
                addToLiveMeeting(url: $url, meeting_name: $title) {
                    success
                    message
                }
            }
            """
            response = requests.post(
                "https://api.fireflies.ai/graphql",
                headers={
                    "Authorization": f"Bearer {fireflies_api_key}",
                    "Content-Type": "application/json"
                },
                json={"query": query, "variables": {"url": meet_link, "title": summary}},
                timeout=15
            )
            result = response.json().get("data", {}).get("addToLiveMeeting", {})
            if result.get("success"):
                print(f"[FIREFLIES] Bot invited for appointment {appointment_id}")
            else:
                print(f"[FIREFLIES] Bot invite failed: {result.get('message')}")
    except Exception as e:
        print(f"[FIREFLIES] Error inviting bot: {e}")


    # Step 3: Send emails
    try:
        send_at = appointment_start_utc - timedelta(minutes=30)
        now = datetime.now(timezone.utc)
        delay_seconds = (send_at - now).total_seconds()
        if delay_seconds > 0:
            import time
            time.sleep(delay_seconds)

        if patient_email:
            send_meet_link_email(
                to_email=patient_email,
                recipient_name=patient_name,
                doctor_name=doctor_name,
                appointment_date=appointment_date,
                start_time=start_time_str,
                end_time=end_time_str,
                meet_link=meet_link
            )
        if doctor_email:
            send_meet_link_email(
                to_email=doctor_email,
                recipient_name=f"Dr. {doctor_name}",
                doctor_name=doctor_name,
                appointment_date=appointment_date,
                start_time=start_time_str,
                end_time=end_time_str,
                meet_link=meet_link
            )
    except Exception as e:
        print(f"[MEET EMAIL] Failed for appointment {appointment_id}: {e}")


# -------------------------------------------------------------------
# DEBUG — Test meet link generation directly
# -------------------------------------------------------------------

@router.get("/test-meet-link")
async def test_meet_link():
    from ..services.google_calendar import TOKEN_PATH, CREDENTIALS_PATH

    results = {}
    results["token_path"] = TOKEN_PATH
    results["credentials_path"] = CREDENTIALS_PATH
    results["token_exists"] = os.path.exists(TOKEN_PATH)
    results["credentials_exists"] = os.path.exists(CREDENTIALS_PATH)

    if not results["token_exists"]:
        return {"status": "failed", "reason": "token.json not found at the path above", **results}

    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        creds = Credentials.from_authorized_user_file(
            TOKEN_PATH, ['https://www.googleapis.com/auth/calendar']
        )
        results["creds_valid"] = creds.valid
        results["creds_expired"] = creds.expired
        results["has_refresh_token"] = bool(creds.refresh_token)

        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            results["refresh_attempted"] = True
            results["creds_valid_after_refresh"] = creds.valid
    except Exception as e:
        return {
            "status": "failed",
            "reason": f"credentials error: {str(e)}",
            "traceback": traceback.format_exc(),
            **results
        }

    try:
        service = get_calendar_service()
        if not service:
            return {"status": "failed", "reason": "GoogleCalendarService returned None", **results}

        start = datetime.now(timezone.utc) + timedelta(hours=1)
        end = start + timedelta(minutes=30)
        link = service.create_event("Test Meeting", start, end)
        results["meet_link"] = link
        return {
            "status": "ok" if link else "failed — event created but no hangoutLink in response",
            **results
        }
    except Exception as e:
        return {
            "status": "failed",
            "reason": f"create_event error: {str(e)}",
            "traceback": traceback.format_exc(),
            **results
        }


# -------------------------------------------------------------------
# 1. Manage Availability
# -------------------------------------------------------------------

@router.post("/availability", response_model=schemas.AvailabilityOut)
async def create_availability(
    slot: schemas.AvailabilityCreate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    target_doctor_id = slot.doctor_id
    org_id = slot.organization_id or current_user.organization_id

    if slot.start_time.tzinfo:
        start_naive = slot.start_time.astimezone(IST).replace(tzinfo=None, microsecond=0)
    else:
        start_naive = slot.start_time.replace(microsecond=0)

    if slot.end_time.tzinfo:
        end_naive = slot.end_time.astimezone(IST).replace(tzinfo=None, microsecond=0)
    else:
        end_naive = slot.end_time.replace(microsecond=0)

    if current_user.role == models.UserRole.RECEPTIONIST:
        rec_res = await db.execute(
            select(models.Receptionist)
            .options(selectinload(models.Receptionist.doctors))
            .where(models.Receptionist.user_id == current_user.id)
        )
        receptionist_profile = rec_res.scalars().first()
        if not receptionist_profile:
            raise HTTPException(status_code=403, detail="Receptionist profile not found")
        assigned_user_ids = [d.user_id for d in receptionist_profile.doctors]
        if target_doctor_id not in assigned_user_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this doctor")

    elif current_user.role == models.UserRole.HOSPITAL:
        doc_res = await db.execute(
            select(models.Doctor)
            .join(models.User, models.User.id == models.Doctor.user_id)
            .where(
                models.Doctor.user_id == target_doctor_id,
                models.User.organization_id == current_user.organization_id
            )
        )
        if not doc_res.scalars().first():
            raise HTTPException(status_code=403, detail="Doctor not found in your organization")

    elif current_user.role == models.UserRole.DOCTOR:
        if target_doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Doctors can only manage their own availability")

    new_slot = models.Availability(
        doctor_id=target_doctor_id,
        organization_id=org_id,
        start_time=start_naive,
        end_time=end_naive,
        is_booked=False,
        created_by_id=current_user.id
    )
    db.add(new_slot)
    await db.commit()

    res = await db.execute(
        select(models.Availability)
        .options(selectinload(models.Availability.doctor))
        .where(models.Availability.id == new_slot.id)
    )
    return res.scalars().first()


@router.post("/availability/batch", response_model=List[schemas.AvailabilityOut])
async def batch_create_availability(
    batch: schemas.AvailabilityBatchCreate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    target_doctor_id = batch.doctor_id
    org_id = batch.organization_id or current_user.organization_id

    if current_user.role == models.UserRole.DOCTOR:
        if target_doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Doctors can only manage their own availability")

    elif current_user.role == models.UserRole.RECEPTIONIST:
        rec_res = await db.execute(
            select(models.Receptionist)
            .options(selectinload(models.Receptionist.doctors))
            .where(models.Receptionist.user_id == current_user.id)
        )
        receptionist_profile = rec_res.scalars().first()
        if not receptionist_profile:
            raise HTTPException(status_code=403, detail="Receptionist profile not found")
        assigned_user_ids = [d.user_id for d in receptionist_profile.doctors]
        if target_doctor_id not in assigned_user_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this doctor")

    elif current_user.role == models.UserRole.HOSPITAL:
        doc_res = await db.execute(
            select(models.Doctor)
            .join(models.User, models.User.id == models.Doctor.user_id)
            .where(
                models.Doctor.user_id == target_doctor_id,
                models.User.organization_id == org_id
            )
        )
        if not doc_res.scalars().first():
            raise HTTPException(status_code=403, detail="Doctor not found in your organization")

    slots = []

    if batch.start_time.tzinfo:
        current_time = batch.start_time.astimezone(IST).replace(tzinfo=None, microsecond=0)
    else:
        current_time = batch.start_time.replace(microsecond=0)

    if batch.end_time.tzinfo:
        batch_end_time = batch.end_time.astimezone(IST).replace(tzinfo=None, microsecond=0)
    else:
        batch_end_time = batch.end_time.replace(microsecond=0)

    while current_time and batch_end_time and current_time + timedelta(minutes=batch.duration_minutes) <= batch_end_time:
        slot_end = current_time + timedelta(minutes=batch.duration_minutes)
        new_slot = models.Availability(
            doctor_id=target_doctor_id,
            organization_id=org_id,
            start_time=current_time,
            end_time=slot_end,
            is_booked=False,
            created_by_id=current_user.id
        )
        db.add(new_slot)
        slots.append(new_slot)
        current_time = slot_end

    if not slots:
        raise HTTPException(status_code=400, detail="No slots generated — check start/end time and duration")

    await db.commit()

    result = await db.execute(
        select(models.Availability)
        .options(selectinload(models.Availability.doctor))
        .where(
            models.Availability.doctor_id == target_doctor_id,
            models.Availability.organization_id == org_id,
            models.Availability.start_time >= slots[0].start_time,
            models.Availability.start_time <= slots[-1].start_time
        )
        .order_by(models.Availability.start_time)
    )
    return result.scalars().all()


@router.get("/availability", response_model=List[schemas.AvailabilityOut])
async def get_availability(
    doctor_id: Optional[int] = None,
    organization_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    only_available: bool = True,
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Availability).options(selectinload(models.Availability.doctor))
    if doctor_id:
        query = query.where(models.Availability.doctor_id == doctor_id)
    if organization_id:
        query = query.where(models.Availability.organization_id == organization_id)
    if start_date:
        query = query.where(models.Availability.start_time >= start_date.replace(tzinfo=None))
    if end_date:
        query = query.where(models.Availability.start_time <= end_date.replace(tzinfo=None))
    if only_available:
        query = query.where(models.Availability.is_booked == False)

    result = await db.execute(query)
    return result.scalars().all()


# -------------------------------------------------------------------
# 2. Booking
# -------------------------------------------------------------------

@router.post("/book", response_model=schemas.AppointmentOut)
async def book_appointment(
    booking: schemas.AppointmentCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    slot_res = await db.execute(
        select(models.Availability)
        .options(selectinload(models.Availability.doctor))
        .where(models.Availability.id == booking.availability_id)
    )
    slot = slot_res.scalars().first()

    if not slot:
        raise HTTPException(status_code=404, detail="Availability slot not found")
    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Slot is already booked")
    if not slot.doctor_id:
        raise HTTPException(status_code=400, detail="Slot has no doctor assigned")

    patient_res = await db.execute(
        select(models.Patient).where(models.Patient.id == booking.patient_id)
    )
    patient = patient_res.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor_user = slot.doctor

    new_app = models.Appointment(
        patient_id=booking.patient_id,
        doctor_id=slot.doctor_id,
        organization_id=slot.organization_id,
        availability_id=slot.id,
        appointment_date=slot.start_time,
        start_time=slot.start_time,
        end_time=slot.end_time,
        notes=booking.notes,
        meet_link=None,
        status="SCHEDULED",
        patient_name=patient.full_name,
        patient_age=booking.patient_age,
        doctor_name=slot.doctor.full_name if slot.doctor else None,
        booked_by_role=current_user.role.value,
        created_by_id=current_user.id
    )

    slot.is_booked = True
    db.add(new_app)
    await db.commit()

    doctor_email = doctor_user.email if (doctor_user and doctor_user.role == models.UserRole.DOCTOR) else None

    # KEY FIX: Use a real thread instead of FastAPI BackgroundTasks
    # This returns the response immediately without waiting for Google Calendar
    thread = threading.Thread(
        target=generate_meet_link_sync,
        kwargs=dict(
            appointment_id=new_app.id,
            summary=f"Appointment: {patient.full_name} with Dr. {slot.doctor.full_name if slot.doctor else 'Unknown'}",
            start_time_utc=slot.start_time.replace(tzinfo=IST).astimezone(timezone.utc),
            end_time_utc=slot.end_time.replace(tzinfo=IST).astimezone(timezone.utc),
            patient_email=patient.email,
            doctor_email=doctor_email,
            patient_name=patient.full_name,
            doctor_name=slot.doctor.full_name if slot.doctor else "Unknown",
            appointment_date=slot.start_time.strftime("%Y-%m-%d"),
            start_time_str=slot.start_time.strftime("%H:%M"),
            end_time_str=slot.end_time.strftime("%H:%M"),
            appointment_start_utc=slot.start_time.replace(tzinfo=timezone.utc),
        ),
        daemon=True
    )
    thread.start()

    res = await db.execute(
        select(models.Appointment)
        .options(
            selectinload(models.Appointment.doctor),
            selectinload(models.Appointment.patient)
        )
        .where(models.Appointment.id == new_app.id)
    )
    return res.scalars().first()


# -------------------------------------------------------------------
# 3. Cancellation / Slot Removal
# -------------------------------------------------------------------

@router.delete("/availability/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_availability_slot(
    slot_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    slot_res = await db.execute(
        select(models.Availability).where(models.Availability.id == slot_id)
    )
    slot = slot_res.scalars().first()

    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if slot.is_booked:
        app_res = await db.execute(
            select(models.Appointment).where(
                models.Appointment.doctor_id == slot.doctor_id,
                models.Appointment.start_time == slot.start_time,
                models.Appointment.status == "SCHEDULED"
            )
        )
        appointment = app_res.scalars().first()
        if appointment:
            appointment.status = "CANCELLED"
            appointment.notes = (appointment.notes or "") + " [CANCELLED: Doctor Unavailable]"
            print(f"NOTIFICATION: Appointment {appointment.id} cancelled.")

    await db.delete(slot)
    await db.commit()
    return None


@router.get("", response_model=List[schemas.AppointmentOut])
async def get_appointments(
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Appointment).options(
        selectinload(models.Appointment.doctor),
        selectinload(models.Appointment.patient)
    )
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Appointment.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.DOCTOR:
        query = query.where(models.Appointment.doctor_id == current_user.id)
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.where(models.Appointment.organization_id == current_user.organization_id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{appointment_id}/reschedule", response_model=schemas.AppointmentOut)
async def reschedule_appointment(
    appointment_id: int,
    new_booking: schemas.AppointmentReschedule,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST])),
    db: AsyncSession = Depends(database.get_db)
):
    app_res = await db.execute(
        select(models.Appointment)
        .options(selectinload(models.Appointment.doctor), selectinload(models.Appointment.patient))
        .where(models.Appointment.id == appointment_id)
    )
    appointment = app_res.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appointment.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this appointment")

    slot_res = await db.execute(
        select(models.Availability).where(models.Availability.id == new_booking.new_availability_id)
    )
    new_slot = slot_res.scalars().first()
    if not new_slot or new_slot.is_booked:
        raise HTTPException(status_code=400, detail="New slot is unavailable or already booked")

    old_slot_res = await db.execute(
        select(models.Availability).where(models.Availability.id == appointment.availability_id)
    )
    old_slot = old_slot_res.scalars().first()
    if old_slot:
        old_slot.is_booked = False

    appointment.availability_id = new_slot.id
    appointment.start_time = new_slot.start_time
    appointment.end_time = new_slot.end_time
    appointment.appointment_date = new_slot.start_time
    appointment.status = models.AppointmentStatus.RESCHEDULED
    new_slot.is_booked = True

    await db.commit()
    await db.refresh(appointment)
    return appointment


@router.get("/updated", response_model=List[schemas.AppointmentOut])
async def get_updated_appointments(
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Appointment).options(
        selectinload(models.Appointment.doctor),
        selectinload(models.Appointment.patient)
    ).where(
        models.Appointment.status == models.AppointmentStatus.RESCHEDULED,
        models.Appointment.organization_id == current_user.organization_id
    )
    if current_user.role == models.UserRole.DOCTOR:
        query = query.where(models.Appointment.doctor_id == current_user.id)

    result = await db.execute(query)
    return result.scalars().all()