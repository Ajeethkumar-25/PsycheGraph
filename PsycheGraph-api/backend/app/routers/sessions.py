from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from .. import models, schemas, dependencies, database
from ..services.fireflies import get_transcript
import json
from datetime import datetime, timezone
import logging
import traceback

logger = logging.getLogger("sessions")

router = APIRouter(prefix="/sessions", tags=["Sessions"])


# -------------------------------------------------------------------
# Create Session manually
# -------------------------------------------------------------------

@router.post("/", response_model=schemas.SessionOut)
async def create_session(
    session_in: schemas.SessionCreate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    if current_user.role == models.UserRole.DOCTOR:
        actual_doctor_id = current_user.id
    else:
        actual_doctor_id = session_in.doctor_id

    patient_res = await db.execute(
        select(models.Patient).where(models.Patient.id == session_in.patient_id)
    )
    patient = patient_res.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Patient not in your organization")

    # Serialize SOAPNote to JSON string for storage
    soap_notes_str = None
    if session_in.soap_notes:
        soap_notes_str = json.dumps(session_in.soap_notes.model_dump())

    if session_in.appointment_id:
        existing_res = await db.execute(
            select(models.Session).where(models.Session.appointment_id == session_in.appointment_id)
        )
        if existing_res.scalars().first():
            raise HTTPException(status_code=400, detail="A session already exists for this appointment")

    new_session = models.Session(
        patient_id=session_in.patient_id,
        doctor_id=actual_doctor_id,
        appointment_id=session_in.appointment_id,
        created_by_id=current_user.id,
        session_date=datetime.now(timezone.utc),
        soap_notes=soap_notes_str,
    )

    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session


# -------------------------------------------------------------------
# Fetch transcript from Fireflies and save to session
# POST /sessions/{appointment_id}/fetch-transcript
#
# Call this after the meeting ends.
# Fireflies takes 3-5 minutes to process after meeting ends.
# -------------------------------------------------------------------

@router.post("/{appointment_id}/fetch-transcript", response_model=schemas.SessionOut)
async def fetch_and_save_transcript(
    appointment_id: int,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    apt_res = await db.execute(
        select(models.Appointment).where(models.Appointment.id == appointment_id)
    )
    appointment = apt_res.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not appointment.meet_link:
        raise HTTPException(status_code=400, detail="No meet link found for this appointment")

    fireflies_data = get_transcript(appointment.meet_link)
    if not fireflies_data:
        raise HTTPException(
            status_code=404,
            detail="No transcript found on Fireflies yet — wait 3-5 minutes after meeting ends and try again"
        )

    transcript_text = fireflies_data.get("transcript", "")
    summary_text = fireflies_data.get("summary", "")
    # Note: action_items from Fireflies are NOT saved to soap_notes
    # soap_notes is exclusively for doctor to fill manually

    session_res = await db.execute(
        select(models.Session).where(models.Session.appointment_id == appointment_id)
    )
    existing_session = session_res.scalars().first()

    if existing_session:
        # Only update transcript and summary — never overwrite doctor's soap_notes
        existing_session.transcript = transcript_text
        existing_session.summary = summary_text
        existing_session.version += 1
        await db.commit()
        await db.refresh(existing_session)
        logger.info(f"[FIREFLIES] Updated session {existing_session.id} for appointment {appointment_id}")
        return existing_session
    else:
        new_session = models.Session(
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            appointment_id=appointment_id,
            created_by_id=current_user.id,
            session_date=datetime.now(timezone.utc),
            transcript=transcript_text,
            summary=summary_text,
        )
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
        logger.info(f"[FIREFLIES] Created new session for appointment {appointment_id}")
        return new_session


# -------------------------------------------------------------------
# Get all sessions
# -------------------------------------------------------------------

@router.get("", response_model=List[schemas.SessionOut])
async def get_sessions(
    patient_id: Optional[int] = None,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Session)

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.join(models.Patient).where(
            models.Patient.organization_id == current_user.organization_id
        )
    elif current_user.role == models.UserRole.DOCTOR:
        query = query.where(models.Session.doctor_id == current_user.id)
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.join(models.Patient).where(
            models.Patient.created_by_id == current_user.id
        )
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    if patient_id:
        query = query.where(models.Session.patient_id == patient_id)

    try:
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error in get_sessions: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to retrieve sessions. Please try again.")


# -------------------------------------------------------------------
# Get single session
# -------------------------------------------------------------------

@router.get("/{session_id}", response_model=schemas.SessionOut)
async def get_session(
    session_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Session).where(models.Session.id == session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        patient_res = await db.execute(
            select(models.Patient).where(models.Patient.id == session.patient_id)
        )
        patient = patient_res.scalars().first()
        if not patient or patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.DOCTOR:
        if session.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.RECEPTIONIST:
        patient_res = await db.execute(
            select(models.Patient).where(models.Patient.id == session.patient_id)
        )
        patient = patient_res.scalars().first()
        if not patient or patient.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    return session


# -------------------------------------------------------------------
# Update session — doctor fills soap_notes manually here
# -------------------------------------------------------------------

@router.put("/{session_id}", response_model=schemas.SessionOut)
async def update_session(
    session_id: int,
    session_update: schemas.SessionUpdate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Session).where(models.Session.id == session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        patient_res = await db.execute(
            select(models.Patient).where(models.Patient.id == session.patient_id)
        )
        patient = patient_res.scalars().first()
        if not patient or patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.DOCTOR:
        if session.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = session_update.model_dump(exclude_unset=True)
    if "soap_notes" in update_data and update_data["soap_notes"] is not None:
        update_data["soap_notes"] = json.dumps(update_data["soap_notes"])
    for key, value in update_data.items():
        setattr(session, key, value)
    session.version += 1

    await db.commit()
    await db.refresh(session)
    return session


# -------------------------------------------------------------------
# Delete session
# -------------------------------------------------------------------

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Session).where(models.Session.id == session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role != models.UserRole.SUPER_ADMIN:
        patient_res = await db.execute(
            select(models.Patient).where(models.Patient.id == session.patient_id)
        )
        patient = patient_res.scalars().first()
        if not patient or patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(session)
    await db.commit()
    return None