from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from .. import models, schemas, dependencies, database
from ..services.vexa import get_transcript, extract_meeting_code
from datetime import datetime, timezone
import logging
import traceback

logger = logging.getLogger("sessions")

router = APIRouter(prefix="/sessions", tags=["Sessions"])


# -------------------------------------------------------------------
# Create Session manually (without audio)
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

    new_session = models.Session(
        patient_id=session_in.patient_id,
        doctor_id=actual_doctor_id,
        appointment_id=session_in.appointment_id,
        created_by_id=current_user.id,
        session_date=datetime.now(timezone.utc),
        transcript=session_in.transcript,
        summary=session_in.summary,
        soap_notes=session_in.soap_notes,
    )

    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session


# -------------------------------------------------------------------
# Vexa Webhook — Vexa calls this when meeting ends and transcript ready
# POST /sessions/vexa/webhook
# Register this URL in Vexa dashboard once:
#   https://65.1.249.160/sessions/vexa/webhook
#
# Vexa payload contains:
#   meeting_id   — the Google Meet code  (e.g. abc-defg-hij)
#   transcript   — array of {speaker, text} segments
# -------------------------------------------------------------------

@router.post("/vexa/webhook")
async def vexa_webhook(
    request: Request,
    db: AsyncSession = Depends(database.get_db)
):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"[VEXA WEBHOOK] Received payload keys: {list(payload.keys())}")

    # Extract meeting code — Vexa sends native_meeting_id or meeting_id
    meeting_code = (
        payload.get("native_meeting_id")
        or payload.get("meeting_id")
        or payload.get("meetingId")
    )
    if not meeting_code:
        logger.error(f"[VEXA WEBHOOK] No meeting_id in payload: {payload}")
        raise HTTPException(status_code=400, detail="Missing meeting_id in payload")

    # Find appointment by meet_link containing this meeting code
    apt_res = await db.execute(
        select(models.Appointment).where(
            models.Appointment.meet_link.ilike(f"%{meeting_code}%")
        )
    )
    appointment = apt_res.scalars().first()
    if not appointment:
        logger.error(f"[VEXA WEBHOOK] No appointment found for meeting code: {meeting_code}")
        raise HTTPException(status_code=404, detail=f"No appointment found for meeting: {meeting_code}")

    logger.info(f"[VEXA WEBHOOK] Matched appointment {appointment.id} for meeting {meeting_code}")

    # Build transcript text from payload segments (if included in webhook)
    # Otherwise fetch from Vexa API
    transcript_text = ""
    segments = payload.get("transcript") or payload.get("segments") or []

    if segments:
        lines = []
        for seg in segments:
            speaker = seg.get("speaker") or seg.get("speaker_name") or "Unknown"
            text = (seg.get("text") or "").strip()
            if text:
                lines.append(f"[{speaker}]: {text}")
        transcript_text = "\n".join(lines)
        logger.info(f"[VEXA WEBHOOK] Built transcript from webhook payload — {len(segments)} segments")
    else:
        # Fetch transcript from Vexa API
        logger.info(f"[VEXA WEBHOOK] No segments in payload — fetching from Vexa API")
        transcript_data = get_transcript(meeting_code)
        if transcript_data:
            transcript_text = transcript_data.get("transcript", "")
        else:
            logger.warning(f"[VEXA WEBHOOK] Could not fetch transcript for {meeting_code}")

    # Check if session already exists for this appointment
    session_res = await db.execute(
        select(models.Session).where(
            models.Session.appointment_id == appointment.id
        )
    )
    existing_session = session_res.scalars().first()

    if existing_session:
        existing_session.transcript = transcript_text
        existing_session.version += 1
        await db.commit()
        await db.refresh(existing_session)
        logger.info(f"[VEXA WEBHOOK] Updated session {existing_session.id} for appointment {appointment.id}")
    else:
        new_session = models.Session(
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            appointment_id=appointment.id,
            created_by_id=appointment.doctor_id,
            session_date=datetime.now(timezone.utc),
            transcript=transcript_text,
            summary="",
            soap_notes=""
        )
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
        logger.info(f"[VEXA WEBHOOK] Created new session for appointment {appointment.id}")

    return {"status": "ok", "appointment_id": appointment.id, "meeting_code": meeting_code}


# -------------------------------------------------------------------
# Manually fetch transcript from Vexa for an appointment
# POST /sessions/{appointment_id}/fetch-transcript
# Use this if webhook failed or for testing
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

    meeting_code = extract_meeting_code(appointment.meet_link)
    if not meeting_code:
        raise HTTPException(status_code=400, detail="Could not extract meeting code from meet link")

    transcript_data = get_transcript(meeting_code)
    if not transcript_data:
        raise HTTPException(
            status_code=404,
            detail="No transcript found on Vexa yet — meeting may still be processing"
        )

    transcript_text = transcript_data.get("transcript", "")

    session_res = await db.execute(
        select(models.Session).where(models.Session.appointment_id == appointment_id)
    )
    existing_session = session_res.scalars().first()

    if existing_session:
        existing_session.transcript = transcript_text
        existing_session.version += 1
        await db.commit()
        await db.refresh(existing_session)
        return existing_session
    else:
        new_session = models.Session(
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            appointment_id=appointment_id,
            created_by_id=current_user.id,
            session_date=datetime.now(timezone.utc),
            transcript=transcript_text,
            summary="",
            soap_notes=""
        )
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
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
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


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
# Update session
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