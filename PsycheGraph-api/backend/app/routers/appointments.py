from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from .. import models, schemas, dependencies, database
from datetime import datetime, timedelta, timezone

# IMPORTANT: use global calendar instance
from ..services.google_calendar import google_calendar_service as calendar_service

from ..services.email import send_appointment_email

import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor()

IST = timezone(timedelta(hours=5, minutes=30))

router = APIRouter(prefix="/appointments", tags=["Appointments"])


# ---------------------------------------------------------
# BOOK APPOINTMENT
# ---------------------------------------------------------
@router.post("/book", response_model=schemas.AppointmentOut)
async def book_appointment(
    booking: schemas.AppointmentCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):

    # check slot
    slot_res = await db.execute(
        select(models.Availability)
        .options(selectinload(models.Availability.doctor))
        .where(models.Availability.id == booking.availability_id)
    )
    slot = slot_res.scalars().first()

    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Slot already booked")

    # patient
    patient_res = await db.execute(
        select(models.Patient).where(models.Patient.id == booking.patient_id)
    )
    patient = patient_res.scalars().first()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # ---------------------------------------
    # GOOGLE MEET GENERATION (ASYNC SAFE)
    # ---------------------------------------
    slot_start_ist = slot.start_time.replace(tzinfo=IST)
    slot_end_ist = slot.end_time.replace(tzinfo=IST)

    try:
        loop = asyncio.get_event_loop()

        meet_link = await asyncio.wait_for(
            loop.run_in_executor(
                executor,
                lambda: calendar_service.create_event(
                    summary=f"Appointment: {patient.full_name}",
                    start_time=slot_start_ist.astimezone(timezone.utc),
                    end_time=slot_end_ist.astimezone(timezone.utc),
                    attendee_email=patient.email or current_user.email
                )
            ),
            timeout=6
        )

    except Exception as e:
        print("Meet generation failed:", e)
        meet_link = None

    # ---------------------------------------
    # SAVE APPOINTMENT
    # ---------------------------------------
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
    await db.refresh(new_app)

    # ---------------------------------------
    # EMAIL (BACKGROUND)
    # ---------------------------------------
    if patient.email:
        background_tasks.add_task(
            send_appointment_email,
            to_email=patient.email,
            patient_name=patient.full_name,
            doctor_name=slot.doctor.full_name if slot.doctor else "Doctor",
            appointment_date=slot.start_time.strftime("%Y-%m-%d"),
            start_time=slot.start_time.strftime("%H:%M"),
            end_time=slot.end_time.strftime("%H:%M"),
            meet_link=meet_link or ""
        )

    return new_app


# ---------------------------------------------------------
# GET APPOINTMENTS
# ---------------------------------------------------------
@router.get("", response_model=List[schemas.AppointmentOut])
async def get_appointments(
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):

    query = select(models.Appointment).options(
        selectinload(models.Appointment.doctor),
        selectinload(models.Appointment.patient)
    )

    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(
            models.Appointment.organization_id == current_user.organization_id
        )

    if current_user.role == models.UserRole.DOCTOR:
        query = query.where(
            models.Appointment.doctor_id == current_user.doctor_id
        )

    result = await db.execute(query)
    return result.scalars().all()