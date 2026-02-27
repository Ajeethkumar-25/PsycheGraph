from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from .. import models, schemas, auth, dependencies, database
from sqlalchemy.orm import selectinload
from ..services.email import send_license_key_email
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor()

router = APIRouter(prefix="/admin", tags=["Admin"])


# -------------------------------------------------------------------
# Organization Registration (Super Admin only)
# -------------------------------------------------------------------

@router.post("/organizations/register", response_model=schemas.OrganizationOut)
async def register_organization(
    org: schemas.OrganizationCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    existing = await db.execute(
        select(models.Organization).where(models.Organization.name == org.name)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Organization name already exists")

    existing_key = await db.execute(
        select(models.Organization).where(models.Organization.license_key == org.license_key)
    )
    if existing_key.scalars().first():
        raise HTTPException(status_code=400, detail="License key already in use")

    new_org = models.Organization(
        name=org.name,
        email=org.email,
        license_key=org.license_key,
        is_approved=True
    )
    db.add(new_org)
    try:
        await db.commit()
        await db.refresh(new_org)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")

    background_tasks.add_task(
        send_license_key_email,
        to_email=new_org.email,
        org_name=new_org.name,
        license_key=new_org.license_key
    )
    return new_org


# -------------------------------------------------------------------
# Organization CRUD (Super Admin only)
# -------------------------------------------------------------------

@router.get("/organizations", response_model=List[schemas.OrganizationOut])
async def get_organizations(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Organization).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/organizations/{org_id}", response_model=schemas.OrganizationOut)
async def get_organization(
    org_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Organization).where(models.Organization.id == org_id)
    )
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.put("/organizations/{org_id}", response_model=schemas.OrganizationOut)
async def update_organization(
    org_id: int,
    org_update: schemas.OrganizationUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Organization).where(models.Organization.id == org_id)
    )
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    update_data = org_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(org, key, value)

    await db.commit()
    await db.refresh(org)
    return org


@router.delete("/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Organization).where(models.Organization.id == org_id)
    )
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await db.delete(org)
    await db.commit()
    return None


# -------------------------------------------------------------------
# Helper
# -------------------------------------------------------------------

async def get_role_users(
    role: models.UserRole,
    skip: int,
    limit: int,
    current_user: models.User,
    db: AsyncSession,
    org_id: Optional[int] = None
):
    query = select(models.User).options(
        selectinload(models.User.doctor_profile),
        selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)
    ).where(models.User.role == role)

    if current_user.role == models.UserRole.SUPER_ADMIN:
        if org_id:
            query = query.where(models.User.organization_id == org_id)
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# -------------------------------------------------------------------
# Hospital Admin Management (Super Admin only)
# -------------------------------------------------------------------

hospital_router = APIRouter(prefix="/admin/hospitals", tags=["Hospital Login"])

@hospital_router.get("", response_model=List[schemas.UserOut])
async def list_hospitals(
    skip: int = 0, limit: int = 100,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    return await get_role_users(models.UserRole.HOSPITAL, skip, limit, current_user, db)

@hospital_router.get("/{user_id}", response_model=schemas.UserOut)
async def get_hospital(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.User).options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)).where(models.User.id == user_id, models.User.role == models.UserRole.HOSPITAL)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Hospital Admin not found")
    return user

@hospital_router.put("/{user_id}", response_model=schemas.UserOut)
async def update_hospital(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.User).options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)).where(models.User.id == user_id, models.User.role == models.UserRole.HOSPITAL)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Hospital Admin not found")

    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(update_data.pop("password"))
    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user

@hospital_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hospital(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.User).options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)).where(models.User.id == user_id, models.User.role == models.UserRole.HOSPITAL)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Hospital Admin not found")
    await db.delete(user)
    await db.commit()
    return None


# -------------------------------------------------------------------
# Doctor Management
# -------------------------------------------------------------------

doctor_router = APIRouter(prefix="/admin/doctors", tags=["Doctor Login"])

@doctor_router.post("", response_model=schemas.UserOut)
async def create_doctor(
    user: schemas.DoctorRegister,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db),
    organization_id: Optional[int] = None
):
    if current_user.role == models.UserRole.HOSPITAL:
        org_id = current_user.organization_id
    elif current_user.role == models.UserRole.SUPER_ADMIN:
        if not organization_id:
            raise HTTPException(status_code=400, detail="Super Admin must provide organization_id as a query parameter")
        org_res = await db.execute(select(models.Organization).where(models.Organization.id == organization_id))
        if not org_res.scalars().first():
            raise HTTPException(status_code=404, detail="Organization not found")
        org_id = organization_id

    existing = await db.execute(select(models.User).where(models.User.email == user.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    for rec_id in (user.receptionist_ids or []):
        rec_res = await db.execute(
            select(models.User).where(
                models.User.id == rec_id,
                models.User.role == models.UserRole.RECEPTIONIST,
                models.User.organization_id == org_id
            )
        )
        if not rec_res.scalars().first():
            raise HTTPException(status_code=400, detail=f"Receptionist ID {rec_id} not found in your organization")

    # 1. Create User row
    new_user = models.User(
        email=user.email,
        hashed_password=auth.get_password_hash(user.password),
        role=models.UserRole.DOCTOR,
        organization_id=org_id,
        full_name=user.full_name,
        specialization=user.specialization,
    )
    db.add(new_user)
    try:
        await db.flush()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    # 2. Create Doctor profile row
    new_doctor = models.Doctor(
        user_id=new_user.id,
        full_name=user.full_name,
        specialization=user.specialization,
        created_by_id=current_user.id,
    )
    db.add(new_doctor)
    try:
        await db.flush()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Doctor profile creation failed: {str(e)}")

    # 3. Add this doctor's user_id into each linked receptionist's doctor_ids array
    for rec_id in (user.receptionist_ids or []):
        # Update User.doctor_ids
        rec_user_res = await db.execute(select(models.User).where(models.User.id == rec_id))
        rec_user = rec_user_res.scalars().first()
        if rec_user:
            existing_ids = list(rec_user.doctor_ids or [])
            if new_user.id not in existing_ids:
                existing_ids.append(new_user.id)
                rec_user.doctor_ids = existing_ids

        # Update Receptionist.doctor_ids (keeps both arrays in sync)
        rec_profile_res = await db.execute(
            select(models.Receptionist).where(models.Receptionist.user_id == rec_id)
        )
        rec_profile = rec_profile_res.scalars().first()
        if rec_profile:
            existing_ids = list(rec_profile.doctor_ids or [])
            if new_user.id not in existing_ids:
                existing_ids.append(new_user.id)
                rec_profile.doctor_ids = existing_ids

    await db.commit()
    await db.refresh(new_user)
    return new_user

@doctor_router.get("", response_model=List[schemas.UserOut])
async def list_doctors(
    skip: int = 0, limit: int = 100,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    return await get_role_users(models.UserRole.DOCTOR, skip, limit, current_user, db)

@doctor_router.get("/{user_id}", response_model=schemas.UserOut)
async def get_doctor(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return user

@doctor_router.put("/{user_id}", response_model=schemas.UserOut)
async def update_doctor(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Doctor not found")

    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(update_data.pop("password"))
    update_data.pop("doctor_ids", None)
    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user

@doctor_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Doctor not found")
    await db.delete(user)
    await db.commit()
    return None


# -------------------------------------------------------------------
# Receptionist Management
# -------------------------------------------------------------------

receptionist_router = APIRouter(prefix="/admin/receptionists", tags=["Receptionist Login"])

@receptionist_router.post("", response_model=schemas.UserOut)
async def create_receptionist(
    user: schemas.ReceptionistRegister,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db),
    organization_id: Optional[int] = None
):
    if current_user.role == models.UserRole.HOSPITAL:
        org_id = current_user.organization_id
    elif current_user.role == models.UserRole.SUPER_ADMIN:
        if not organization_id:
            raise HTTPException(status_code=400, detail="Super Admin must provide organization_id as a query parameter")
        org_res = await db.execute(select(models.Organization).where(models.Organization.id == organization_id))
        if not org_res.scalars().first():
            raise HTTPException(status_code=404, detail="Organization not found")
        org_id = organization_id

    existing = await db.execute(select(models.User).where(models.User.email == user.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    validated_doctor_user_ids = []
    for doc_id in (user.doctor_ids or []):
        doc_res = await db.execute(
            select(models.User).where(
                models.User.id == doc_id,
                models.User.role == models.UserRole.DOCTOR,
                models.User.organization_id == org_id
            )
        )
        if not doc_res.scalars().first():
            raise HTTPException(status_code=400, detail=f"Doctor ID {doc_id} not found in your organization")
        validated_doctor_user_ids.append(doc_id)

    # 1. Create User row
    new_user = models.User(
        email=user.email,
        hashed_password=auth.get_password_hash(user.password),
        role=models.UserRole.RECEPTIONIST,
        organization_id=org_id,
        full_name=user.full_name,
        specialization=user.specialization,
        shift_timing=user.shift_timing,
        doctor_ids=validated_doctor_user_ids
    )
    db.add(new_user)
    try:
        await db.flush()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    # 2. Create Receptionist profile row — doctor_ids array stored here
    #    so Receptionist.doctors relationship can resolve Doctor rows.
    new_receptionist = models.Receptionist(
        user_id=new_user.id,
        full_name=user.full_name,
        specialization=user.specialization,
        shift_timing=user.shift_timing,
        doctor_ids=validated_doctor_user_ids,
    )
    db.add(new_receptionist)

    await db.commit()
    await db.refresh(new_user)
    return new_user

@receptionist_router.get("", response_model=List[schemas.UserOut])
async def list_receptionists(
    skip: int = 0, limit: int = 100,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    return await get_role_users(models.UserRole.RECEPTIONIST, skip, limit, current_user, db)

@receptionist_router.get("/{user_id}", response_model=schemas.UserOut)
async def get_receptionist(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)).where(models.User.id == user_id, models.User.role == models.UserRole.RECEPTIONIST)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Receptionist not found")
    return user

@receptionist_router.put("/{user_id}", response_model=schemas.UserOut)
async def update_receptionist(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)).where(models.User.id == user_id, models.User.role == models.UserRole.RECEPTIONIST)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Receptionist not found")

    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(update_data.pop("password"))

    if "doctor_ids" in update_data:
        new_doc_ids = update_data["doctor_ids"] or []
        org_id = user.organization_id
        validated = []
        for doc_id in new_doc_ids:
            doc_res = await db.execute(
                select(models.User).where(
                    models.User.id == doc_id,
                    models.User.role == models.UserRole.DOCTOR,
                    models.User.organization_id == org_id
                )
            )
            if not doc_res.scalars().first():
                raise HTTPException(status_code=400, detail=f"Doctor ID {doc_id} not found in your organization")
            validated.append(doc_id)
        update_data["doctor_ids"] = validated

        # Also keep Receptionist profile doctor_ids in sync
        rec_profile_res = await db.execute(
            select(models.Receptionist).where(models.Receptionist.user_id == user.id)
        )
        rec_profile = rec_profile_res.scalars().first()
        if rec_profile:
            rec_profile.doctor_ids = validated

    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user

@receptionist_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receptionist(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)).where(models.User.id == user_id, models.User.role == models.UserRole.RECEPTIONIST)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Receptionist not found")
    await db.delete(user)
    await db.commit()
    return None