
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

    # Send license key to hospital email (not super admin)
    if new_org.email != current_user.email:
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
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.where(models.User.organization_id == current_user.organization_id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def fetch_user_with_profiles(user_id: int, db: AsyncSession) -> models.User:
    """Re-fetch a user with all profiles eagerly loaded — use after commit."""
    result = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.doctor_profile),
            selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)
        )
        .where(models.User.id == user_id)
    )
    return result.scalars().first()


# -------------------------------------------------------------------
# FIX: Validate multiple doctor IDs in a single IN query
# instead of one DB query per doctor (N+1 problem)
# -------------------------------------------------------------------

async def validate_doctor_user_ids(doctor_user_ids: List[int], org_id: int, db: AsyncSession) -> List[int]:
    """
    Validates a list of doctor user IDs belong to the given org in ONE query.
    Returns the validated list or raises HTTPException for any invalid ID.
    """
    if not doctor_user_ids:
        return []

    result = await db.execute(
        select(models.User.id).where(
            models.User.id.in_(doctor_user_ids),
            models.User.role == models.UserRole.DOCTOR,
            models.User.organization_id == org_id
        )
    )
    found_ids = {row[0] for row in result.fetchall()}

    for uid in doctor_user_ids:
        if uid not in found_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Doctor user ID {uid} not found in your organization"
            )

    return doctor_user_ids


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
    user = await fetch_user_with_profiles(user_id, db)
    if not user or user.role != models.UserRole.HOSPITAL:
        raise HTTPException(status_code=404, detail="Hospital Admin not found")
    return user

@hospital_router.put("/{user_id}", response_model=schemas.UserOut)
async def update_hospital(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    user = await fetch_user_with_profiles(user_id, db)
    if not user or user.role != models.UserRole.HOSPITAL:
        raise HTTPException(status_code=404, detail="Hospital Admin not found")

    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(update_data.pop("password"))
    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    return await fetch_user_with_profiles(user_id, db)

@hospital_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hospital(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    user = await fetch_user_with_profiles(user_id, db)
    if not user or user.role != models.UserRole.HOSPITAL:
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

    # 1. Create User row
    new_user = models.User(
        email=user.email,
        hashed_password=auth.get_password_hash(user.password),
        role=models.UserRole.DOCTOR,
        organization_id=org_id,
        full_name=user.full_name,
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
        created_by_id=current_user.id,
    )
    db.add(new_doctor)
    try:
        await db.flush()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Doctor profile creation failed: {str(e)}")

    await db.commit()
    return await fetch_user_with_profiles(new_user.id, db)

@doctor_router.get("", response_model=List[schemas.UserOut])
async def list_doctors(
    skip: int = 0, limit: int = 100,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL, models.UserRole.RECEPTIONIST])),
    db: AsyncSession = Depends(database.get_db)
):
    return await get_role_users(models.UserRole.DOCTOR, skip, limit, current_user, db)

@doctor_router.get("/{user_id}", response_model=schemas.UserOut)
async def get_doctor(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL, models.UserRole.RECEPTIONIST])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(
        selectinload(models.User.doctor_profile),
        selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)
    ).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
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
    query = select(models.User).options(
        selectinload(models.User.doctor_profile),
        selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)
    ).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
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
    return await fetch_user_with_profiles(user_id, db)

@doctor_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(
        selectinload(models.User.doctor_profile),
        selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)
    ).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
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

    # FIX: validate all doctor IDs in ONE query instead of N queries
    validated_doctor_user_ids = await validate_doctor_user_ids(
        user.assigned_doctor_user_ids or [], org_id, db
    )

    # 1. Create User row
    new_user = models.User(
        email=user.email,
        hashed_password=auth.get_password_hash(user.password),
        role=models.UserRole.RECEPTIONIST,
        organization_id=org_id,
        full_name=user.full_name,
        shift_timing=user.shift_timing,
    )
    db.add(new_user)
    try:
        await db.flush()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    # 2. Create Receptionist profile row — doctor_ids stored here for relationship resolution
    new_receptionist = models.Receptionist(
        user_id=new_user.id,
        full_name=user.full_name,
        shift_timing=user.shift_timing,
        doctor_ids=validated_doctor_user_ids,
    )
    db.add(new_receptionist)
    try:
        await db.flush()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Receptionist profile creation failed: {str(e)}")

    await db.commit()
    return await fetch_user_with_profiles(new_user.id, db)

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
    query = select(models.User).options(
        selectinload(models.User.doctor_profile),
        selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)
    ).where(models.User.id == user_id, models.User.role == models.UserRole.RECEPTIONIST)
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
    query = select(models.User).options(
        selectinload(models.User.doctor_profile),
        selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)
    ).where(models.User.id == user_id, models.User.role == models.UserRole.RECEPTIONIST)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Receptionist not found")

    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(update_data.pop("password"))

    if "assigned_doctor_user_ids" in update_data:
        new_doc_ids = update_data.pop("assigned_doctor_user_ids") or []
        org_id = user.organization_id

        # FIX: validate all doctor IDs in ONE query instead of N queries
        validated = await validate_doctor_user_ids(new_doc_ids, org_id, db)

        # Update Receptionist profile doctor_ids
        rec_profile_res = await db.execute(
            select(models.Receptionist).where(models.Receptionist.user_id == user.id)
        )
        rec_profile = rec_profile_res.scalars().first()
        if rec_profile:
            rec_profile.doctor_ids = validated

    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    return await fetch_user_with_profiles(user_id, db)

@receptionist_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receptionist(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(
        selectinload(models.User.doctor_profile),
        selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctors)
    ).where(models.User.id == user_id, models.User.role == models.UserRole.RECEPTIONIST)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Receptionist not found")
    await db.delete(user)
    await db.commit()
    return None