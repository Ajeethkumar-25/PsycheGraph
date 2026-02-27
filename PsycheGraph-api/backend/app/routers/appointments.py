from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from .. import models, schemas, dependencies, database
from datetime import datetime, timedelta, timezone
from ..services.google_calendar import GoogleCalendarService
from ..services.email import send_meet_link_email
import asyncio
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


async def schedule_meet_link_email(
    appointment_id: int,
    patient_email: Optional[str],
    doctor_email: Optional[str],
    patient_name: str,
    doctor_name: str,
    appointment_date: str,
    start_time: str,
    end_time: str,
    meet_link: str,
    send_at: datetime
):
    now = datetime.now(timezone.utc)
    delay_seconds = (send_at - now).total_seconds()

    if delay_seconds > 0:
        print(f"[MEET EMAIL] Appointment {appointment_id} — email scheduled in {delay_seconds:.0f}s")
        await asyncio.sleep(delay_seconds)

    print(f"[MEET EMAIL] Sending meet link for appointment {appointment_id}")

    if patient_email:
        send_meet_link_email(
            to_email=patient_email,
            recipient_name=patient_name,
            doctor_name=doctor_name,
            appointment_date=appointment_date,
            start_time=start_time,
            end_time=end_time,
            meet_link=meet_link
        )

    if doctor_email:
        send_meet_link_email(
            to_email=doctor_email,
            recipient_name=f"Dr. {doctor_name}",
            doctor_name=doctor_name,
            appointment_date=appointment_date,
            start_time=start_time,
            end_time=end_time,
            meet_link=meet_link
        )


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
    target_doctor_id = slot.doctor_id  # this is a users.id value
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

        # Receptionist.doctors are Doctor profile rows; Doctor.user_id is the users.id
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
    target_doctor_id = batch.doctor_id  # this is a users.id value
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

        # Compare against Doctor.user_id (which equals users.id for that doctor)
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
    query = select(models.Availability).options(
        selectinload(models.Availability.doctor)
    )
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
# 2. Booking Logic
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

    # slot.doctor IS the User object — Availability.doctor_id references users.id directly
    doctor_user = slot.doctor

    slot_start_ist = slot.start_time.replace(tzinfo=IST)
    slot_end_ist = slot.end_time.replace(tzinfo=IST)

    try:
        service = get_calendar_service()
        if service:
            loop = asyncio.get_event_loop()
            meet_link = await asyncio.wait_for(
                loop.run_in_executor(
                    executor,
                    lambda: service.create_event(
                        summary=f"Appointment: {patient.full_name} with Dr. {slot.doctor.full_name if slot.doctor else 'Unknown'}",
                        start_time=slot_start_ist.astimezone(timezone.utc),
                        end_time=slot_end_ist.astimezone(timezone.utc),
                        attendee_email=None
                    )
                ),
                timeout=5.0
            )
        else:
            print("[WARNING] Google Calendar unavailable — booking without meet link")
            meet_link = None
    except asyncio.TimeoutError:
        print("[WARNING] Google Meet link timed out — saving without meet link")
        meet_link = None
    except Exception as e:
        print(f"[WARNING] Google Meet link creation failed: {e}")
        meet_link = None

    new_app = models.Appointment(
        patient_id=booking.patient_id,
        doctor_id=slot.doctor_id,
        organization_id=slot.organization_id,
        availability_id=slot.id,
        appointment_date=slot.start_time,
        start_time=slot.start_time,
        end_time=slot.end_time,
        notes=booking.notes,
        meet_link=meet_link,
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

    if meet_link and (patient.email or (doctor_user and doctor_user.email)):
        appointment_start_utc = slot.start_time.replace(tzinfo=timezone.utc)
        send_at = appointment_start_utc - timedelta(minutes=30)

        background_tasks.add_task(
            schedule_meet_link_email,
            appointment_id=new_app.id,
            patient_email=patient.email,
            doctor_email=doctor_user.email if doctor_user else None,
            patient_name=patient.full_name,
            doctor_name=slot.doctor.full_name if slot.doctor else "Unknown",
            appointment_date=slot.start_time.strftime("%Y-%m-%d"),
            start_time=slot.start_time.strftime("%H:%M"),
            end_time=slot.end_time.strftime("%H:%M"),
            meet_link=meet_link,
            send_at=send_at
        )
        print(f"[MEET EMAIL] Scheduled for appointment {new_app.id} — will send at {send_at.strftime('%Y-%m-%d %H:%M UTC')}")

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