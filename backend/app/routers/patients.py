from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from .. import models, schemas, dependencies, database

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.post("/", response_model=schemas.PatientOut)
async def create_patient(
    patient: schemas.PatientCreate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    # Receptionist can only create patients for their own org
    if current_user.organization_id != patient.organization_id and current_user.role != models.UserRole.SUPER_ADMIN:
         # Force org_id to match current user's org
         patient.organization_id = current_user.organization_id
    
    new_patient = models.Patient(**patient.model_dump())
    db.add(new_patient)
    await db.commit()
    await db.refresh(new_patient)
    return new_patient

@router.get("/", response_model=List[schemas.PatientOut])
async def get_patients(
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    # Logic:
    # SUPER_ADMIN: All (or filtered)
    # ADMIN: All in Org
    # RECEPTIONIST: All in Org
    # DOCTOR: Assigned patients OR All in Org (depending on detailed reqs, usually all in org for visibility)
    
    query = select(models.Patient)
    if current_user.role != models.UserRole.SUPER_ADMIN:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{patient_id}", response_model=schemas.PatientOut)
async def get_patient(
    patient_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Patient).where(models.Patient.id == patient_id)
    if current_user.role != models.UserRole.SUPER_ADMIN:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
        
    result = await db.execute(query)
    patient = result.scalars().first()
    if not patient:
         raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@router.put("/{patient_id}", response_model=schemas.PatientOut)
async def update_patient(
    patient_id: int,
    patient_update: schemas.PatientUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL, models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Patient).where(models.Patient.id == patient_id)
    if current_user.role != models.UserRole.SUPER_ADMIN:
         query = query.where(models.Patient.organization_id == current_user.organization_id)
         
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

@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.HOSPITAL, models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Patient).where(models.Patient.id == patient_id)
    if current_user.role != models.UserRole.SUPER_ADMIN:
         query = query.where(models.Patient.organization_id == current_user.organization_id)
         
    result = await db.execute(query)
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    await db.delete(patient)
    await db.commit()
    return None
