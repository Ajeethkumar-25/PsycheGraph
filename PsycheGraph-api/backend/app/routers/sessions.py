from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from .. import models, schemas, dependencies, database
from datetime import datetime, timezone
import logging
import traceback
import requests
import os

logger = logging.getLogger("sessions")

router = APIRouter(prefix="/sessions", tags=["Sessions"])

FIREFLIES_API_KEY = os.environ.get("FIREFLIES_API_KEY", "")
FIREFLIES_URL = "https://api.fireflies.ai/graphql"


def fireflies_headers():
    return {
        "Authorization": f"Bearer {FIREFLIES_API_KEY}",
        "Content-Type": "application/json"
    }


def add_fireflies_bot(meet_link: str, title: str) -> Optional[str]:
    """Send Fireflies bot to join a Google Meet. Returns meeting ID or None."""
    if not FIREFLIES_API_KEY or not meet_link:
        return None
    try:
        query = """
        mutation AddToLiveMeeting($url: String!, $title: String) {
            addToLiveMeeting(url: $url, meeting_name: $title) {
                success
                message
            }
        }
        """
        response = requests.post(
            FIREFLIES_URL,
            headers=fireflies_headers(),
            json={"query": query, "variables": {"url": meet_link, "title": title}},
            timeout=15
        )
        data = response.json()
        result = data.get("data", {}).get("addToLiveMeeting", {})
        if result.get("success"):
            print(f"[FIREFLIES] Bot added to meeting: {meet_link}")
            return meet_link
        else:
            print(f"[FIREFLIES] Failed to add bot: {result.get('message')}")
            return None
    except Exception as e:
        print(f"[FIREFLIES] Error adding bot: {e}")
        return None


def fetch_fireflies_transcript(meet_link: str) -> Optional[dict]:
    """Fetch transcript from Fireflies by searching for the meeting URL."""
    if not FIREFLIES_API_KEY:
        return None
    try:
        query = """
        query Transcripts {
            transcripts(limit: 10) {
                id
                title
                date
                meeting_link
                summary {
                    overview
                    action_items
                    keywords
                }
                sentences {
                    text
                    speaker_name
                }
            }
        }
        """
        response = requests.post(
            FIREFLIES_URL,
            headers=fireflies_headers(),
            json={"query": query},
            timeout=15
        )
        data = response.json()
        transcripts = data.get("data", {}).get("transcripts", [])

        # Find matching transcript by meet link
        for t in transcripts:
            if meet_link and (
                t.get("meeting_link") == meet_link or
                meet_link.split("/")[-1] in (t.get("meeting_link") or "")
            ):
                return t

        # If no match found, return the most recent one
        if transcripts:
            return transcripts[0]

        return None
    except Exception as e:
        print(f"[FIREFLIES] Error fetching transcript: {e}")
        return None


def format_transcript(sentences: list) -> str:
    """Format Fireflies sentences into readable transcript text."""
    if not sentences:
        return ""
    lines = []
    for s in sentences:
        speaker = s.get("speaker_name") or "Unknown"
        text = s.get("text") or ""
        lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


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
# Fetch transcript from Fireflies and save to session
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
    # Get appointment to find meet_link and patient info
    apt_res = await db.execute(
        select(models.Appointment).where(models.Appointment.id == appointment_id)
    )
    appointment = apt_res.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not appointment.meet_link:
        raise HTTPException(status_code=400, detail="No meet link found for this appointment")

    # Fetch transcript from Fireflies
    fireflies_data = fetch_fireflies_transcript(appointment.meet_link)
    if not fireflies_data:
        raise HTTPException(status_code=404, detail="No transcript found on Fireflies yet. Meeting may still be processing.")

    # Format transcript text
    transcript_text = format_transcript(fireflies_data.get("sentences", []))
    summary_text = ""
    if fireflies_data.get("summary"):
        summary_text = fireflies_data["summary"].get("overview") or ""

    # Check if session already exists for this appointment
    session_res = await db.execute(
        select(models.Session).where(models.Session.appointment_id == appointment_id)
    )
    existing_session = session_res.scalars().first()

    if existing_session:
        # Update existing session
        existing_session.transcript = transcript_text
        existing_session.summary = summary_text
        existing_session.version += 1
        await db.commit()
        await db.refresh(existing_session)
        return existing_session
    else:
        # Create new session
        new_session = models.Session(
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            appointment_id=appointment_id,
            created_by_id=current_user.id,
            session_date=datetime.now(timezone.utc),
            transcript=transcript_text,
            summary=summary_text,
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