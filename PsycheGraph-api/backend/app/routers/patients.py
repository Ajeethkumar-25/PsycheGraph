from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from typing import List
import logging
from .. import models, schemas, dependencies, database

logger = logging.getLogger("patients")

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.post("/", response_model=schemas.PatientOut)
async def create_patient(
    patient: schemas.PatientCreate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    if current_user.role in [models.UserRole.HOSPITAL, models.UserRole.RECEPTIONIST]:
        org_id = current_user.organization_id
    else:
        org_id = patient.organization_id

    if not org_id:
        raise HTTPException(status_code=400, detail="organization_id is required")


    new_patient = models.Patient(
        full_name=patient.full_name,
        date_of_birth=datetime.combine(patient.date_of_birth, datetime.min.time()) if patient.date_of_birth else None,
        phone=patient.contact_number,
        email=patient.email,
        gender=patient.gender,
        address=patient.address,
        organization_id=org_id,
        created_by_id=current_user.id
    )
    db.add(new_patient)
    try:
        await db.commit()
        await db.refresh(new_patient)
    except Exception as e:
        await db.rollback()
        logger.error(f"create_patient commit failed: {e}")
        raise HTTPException(status_code=500, detail="Patient creation failed. Please try again.")
    return new_patient


@router.get("", response_model=List[schemas.PatientOut])
async def get_patients(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Patient)
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.DOCTOR:
        query = query.where(models.Patient.doctor_id == current_user.id)
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = query.offset(skip).limit(limit)
    try:
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logger.error(f"get_patients failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve patients.")


@router.get("/{patient_id}", response_model=schemas.PatientOut)
async def get_patient(
    patient_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Patient).where(models.Patient.id == patient_id)
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.DOCTOR:
        query = query.where(models.Patient.doctor_id == current_user.id)
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        result = await db.execute(query)
        patient = result.scalars().first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return patient
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_patient failed for patient_id={patient_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve patient.")


@router.put("/{patient_id}", response_model=schemas.PatientOut)
async def update_patient(
    patient_id: int,
    patient_update: schemas.PatientUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Patient).where(models.Patient.id == patient_id)
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized to update patient data")

    try:
        result = await db.execute(query)
        patient = result.scalars().first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        update_data = patient_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(patient, key, value)

        await db.commit()
        await db.refresh(patient)
        return patient
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"update_patient failed for patient_id={patient_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update patient.")


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: int,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.HOSPITAL,
        models.UserRole.RECEPTIONIST,
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Patient).where(models.Patient.id == patient_id)

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.where(models.Patient.organization_id == current_user.organization_id)

    try:
        result = await db.execute(query)
        patient = result.scalars().first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        await db.delete(patient)
        await db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"delete_patient failed for patient_id={patient_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete patient.")