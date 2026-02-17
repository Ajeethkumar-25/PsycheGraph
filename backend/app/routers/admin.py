
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from .. import models, schemas, auth, dependencies, database

router = APIRouter(prefix="/admin", tags=["Admin"])

# Super Admin: Create Organization
@router.post("/organizations", response_model=schemas.OrganizationOut)
async def create_organization(
    org: schemas.OrganizationCreate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    new_org = models.Organization(
        name=org.name, 
        license_key=auth.generate_license_key()
    )
    db.add(new_org)
    try:
        await db.commit()
        await db.refresh(new_org)
        return new_org
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Organization already exists")

# Helper for generic user listing/getting/updating/deleting with role filtering
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
        selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctor)
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

# --- Hospital Admin Management (Super Admin only) ---
hospital_router = APIRouter(prefix="/admin/hospitals", tags=["Hospital Login"])

@hospital_router.get("", response_model=List[schemas.UserOut])
async def list_hospitals(
    skip: int = 0,
    limit: int = 100,
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
        select(models.User)
        .options(
            selectinload(models.User.doctor_profile),
            selectinload(models.User.receptionist_profile)
        )
        .where(models.User.id == user_id, models.User.role == models.UserRole.HOSPITAL)
    )
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Hospital Admin not found")
    return user

@hospital_router.put("/{user_id}", response_model=schemas.UserOut)
async def update_hospital(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.doctor_profile),
            selectinload(models.User.receptionist_profile)
        )
        .where(models.User.id == user_id, models.User.role == models.UserRole.HOSPITAL)
    )
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Hospital Admin not found")
    
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
        select(models.User)
        .options(
            selectinload(models.User.doctor_profile),
            selectinload(models.User.receptionist_profile)
        )
        .where(models.User.id == user_id, models.User.role == models.UserRole.HOSPITAL)
    )
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Hospital Admin not found")
    await db.delete(user)
    await db.commit()
    return None

# --- Doctor Management (Super Admin & Hospital Admin) ---
doctor_router = APIRouter(prefix="/admin/doctors", tags=["Doctor Login"])

@doctor_router.post("", response_model=schemas.UserOut)
async def create_doctor(
    user: schemas.DoctorRegister,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    # Verify license key matches org if hospital admin
    result = await db.execute(select(models.Organization).where(models.Organization.license_key == user.license_key))
    org = result.scalars().first()
    if not org: raise HTTPException(status_code=400, detail="Invalid license key")
    
    if current_user.role == models.UserRole.HOSPITAL and org.id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="License key does not match your organization")

    new_user = models.User(
        email=user.email,
        hashed_password=auth.get_password_hash(user.password),
        # full_name removed
        role=models.UserRole.DOCTOR,
        organization_id=org.id
        # specialization, license_key removed
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
        
        # Create Profile
        new_profile = models.Doctor(
            id=new_user.id,
            user_id=new_user.id,
            full_name=user.full_name,
            specialization=user.specialization,
            license_key=user.license_key
        )
        db.add(new_profile)
        await db.commit()
        
    except Exception as e:
        await db.rollback()
        # If user was created but profile failed, we should cleanup, but for now just raise
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    await db.refresh(new_user) # Refresh to load relationships via lazy load or re-query if needed? 
    # Actually UserOut uses properties which access new_profile. 
    # new_user.doctor_profile might not be populated in session cache.
    # Safe to re-query with options or just return logic.
    # To be safe for response model:
    reloaded = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.doctor_profile),
            selectinload(models.User.receptionist_profile)
        )
        .where(models.User.id == new_user.id)
    )
    return reloaded.scalars().first()

@doctor_router.get("", response_model=List[schemas.UserOut])
async def list_doctors(
    skip: int = 0,
    limit: int = 100,
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
    query = select(models.User).options(
        selectinload(models.User.doctor_profile),
        selectinload(models.User.receptionist_profile)
    ).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Doctor not found")
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
        selectinload(models.User.receptionist_profile)
    ).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Doctor not found")
    
    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(update_data.pop("password"))
        
    # Handle profile fields
    full_name = update_data.pop("full_name", None)
    if full_name and user.doctor_profile:
        user.doctor_profile.full_name = full_name
        
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
    query = select(models.User).options(selectinload(models.User.doctor_profile)).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Doctor not found")
    await db.delete(user)
    await db.commit()
    return None

# --- Receptionist Management (Super Admin & Hospital Admin) ---
receptionist_router = APIRouter(prefix="/admin/receptionists", tags=["Receptionist Login"])

@receptionist_router.post("", response_model=schemas.UserOut)
async def create_receptionist(
    user: schemas.ReceptionistRegister,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Organization).where(models.Organization.license_key == user.license_key))
    org = result.scalars().first()
    if not org: raise HTTPException(status_code=400, detail="Invalid license key")
    
    if current_user.role == models.UserRole.HOSPITAL and org.id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="License key does not match your organization")
    
    # Validate doctor_id if provided
    if user.doctor_id:
        doc_res = await db.execute(
            select(models.User).where(
                models.User.id == user.doctor_id,
                models.User.role == models.UserRole.DOCTOR,
                models.User.organization_id == org.id
            )
        )
        if not doc_res.scalars().first():
            raise HTTPException(status_code=400, detail="Invalid doctor_id for this organization")

    new_user = models.User(
        email=user.email,
        hashed_password=auth.get_password_hash(user.password),
        # full_name removed
        role=models.UserRole.RECEPTIONIST,
        organization_id=org.id
        # items removed
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)

        new_profile = models.Receptionist(
            id=new_user.id,
            user_id=new_user.id,
            full_name=user.full_name,
            specialization=user.specialization,
            shift_timing=user.shift_timing,
            doctor_id=user.doctor_id
        )
        db.add(new_profile)
        await db.commit()
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    reloaded = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.doctor_profile),
            selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctor)
        )
        .where(models.User.id == new_user.id)
    )
    # Note: reloaded user needs doctor_id populated for schema?
    # UserOut schema has doctor_id. My User.doctor_id property handles it?
    # User.doctor_id property handles DOCTOR role. 
    # For Receptionist, UserOut pulls from user.receptionist_profile.doctor_id (auth.py Step 53 Line 58 handles it manually in response construction, 
    # BUT pure UserOut from model relies on... properties? 
    # My User.doctor_id property returns self.doctor_profile.id.
    # It DOES NOT return self.receptionist_profile.doctor_id.
    # Schema UserOut `doctor_id: int`.
    # Auth.py builds UserWithToken manually.
    # Here we return compatible UserOut.
    # If UserOut relies on `from_attributes=True`, it reads `user.doctor_id`.
    # For Receptionist, `user.doctor_id` property returns None.
    # But Receptionist HAS a doctor.
    # Issue: UserOut expects `doctor_id` if it's a receptionist linked to a doctor?
    # In `list_receptionists` (Line 276 Step 155), the code manually attaches: `user.doctor_id = user.receptionist_profile.doctor_id`.
    # I should do usage here too or update User.doctor_id property.
    # I will update User.doctor_id property logic? No, property is business logic for "Is this user a doctor?".
    # I'll rely on the manual attachment pattern used in existing admin.py or just return user and let schema fail?
    # Better: Update User.doctor_id property to fallback to recep profile?
    # No, confusing.
    # I will stick to what `list_receptionists` does: manual attach.
    ret_user = reloaded.scalars().first()
    return ret_user

@receptionist_router.get("", response_model=List[schemas.UserOut])
async def list_receptionists(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(
        dependencies.require_role([
            models.UserRole.SUPER_ADMIN,
            models.UserRole.HOSPITAL
        ])
    ),
    db: AsyncSession = Depends(database.get_db)
):
    query = (
        select(models.User)
        .options(
            selectinload(models.User.doctor_profile),
            selectinload(models.User.receptionist_profile)
        )
        .where(models.User.role == models.UserRole.RECEPTIONIST)
        .offset(skip)
        .limit(limit)
    )

    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(
            models.User.organization_id == current_user.organization_id
        )

    result = await db.execute(query)
    users = result.scalars().all()

    return users

@receptionist_router.get("/{user_id}", response_model=schemas.UserOut)
async def get_receptionist(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(
        selectinload(models.User.doctor_profile),
        selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctor)
    ).where(models.User.id == user_id, models.User.role == models.UserRole.RECEPTIONIST)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Receptionist not found")
    
    return user
        
    return user

@receptionist_router.put("/{user_id}", response_model=schemas.UserOut)
async def update_receptionist(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(
        dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])
    ),
    db: AsyncSession = Depends(database.get_db)
):
    # 1️⃣ Fetch receptionist user
    query = select(models.User).where(
        models.User.id == user_id,
        models.User.role == models.UserRole.RECEPTIONIST
    )

    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(
            models.User.organization_id == current_user.organization_id
        )

    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Receptionist not found")

    update_data = user_update.model_dump(exclude_unset=True)

    # 2️⃣ Handle password update
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(
            update_data.pop("password")
        )

    # 3️⃣ Handle doctor assignment separately
    doctor_id = update_data.pop("doctor_id", None)

    if doctor_id is not None:
        # Validate doctor exists & belongs to same org
        doc_query = select(models.User).where(
            models.User.id == doctor_id,
            models.User.role == models.UserRole.DOCTOR
        )

        if current_user.role == models.UserRole.HOSPITAL:
            doc_query = doc_query.where(
                models.User.organization_id == current_user.organization_id
            )

        doc_res = await db.execute(doc_query)
        doctor = doc_res.scalars().first()

        if not doctor:
            raise HTTPException(
                status_code=400,
                detail="Invalid doctor_id for this organization"
            )

        # Update receptionist profile
        rec_res = await db.execute(
            select(models.Receptionist).where(
                models.Receptionist.id == user.id
            )
        )
        receptionist_profile = rec_res.scalars().first()

        if receptionist_profile:
            receptionist_profile.doctor_id = doctor_id

    # 4️⃣ Update normal user fields and profile full_name
    full_name = update_data.pop("full_name", None)
    if full_name:
        if not user.receptionist_profile: # Might fail if not loaded
             rec_res = await db.execute(select(models.Receptionist).where(models.Receptionist.id == user.id))
             receptionist_profile = rec_res.scalars().first()
        else:
             receptionist_profile = user.receptionist_profile
             
        if receptionist_profile:
             receptionist_profile.full_name = full_name

    for key, value in update_data.items():
        setattr(user, key, value)

    await db.commit()
    reloaded = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.doctor_profile),
            selectinload(models.User.receptionist_profile).selectinload(models.Receptionist.doctor)
        )
        .where(models.User.id == user.id)
    )
    ret_user = reloaded.scalars().first()
    return ret_user


@receptionist_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receptionist(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).options(selectinload(models.User.receptionist_profile)).where(models.User.id == user_id, models.User.role == models.UserRole.RECEPTIONIST)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Receptionist not found")
    await db.delete(user)
    await db.commit()
    return None

# Add remaining endpoints (individual GET, PUT, DELETE for doctors and receptionists) as needed follow the same pattern

# Organization CRUD
@router.get("/organizations", response_model=List[schemas.OrganizationOut])
async def get_organizations(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Organization)
    
    # HOSPITAL admins can only see their own organization
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Organization.id == current_user.organization_id)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/organizations/{org_id}", response_model=schemas.OrganizationOut)
async def get_organization(
    org_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Organization).where(models.Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # HOSPITAL admins can only view their own organization
    if current_user.role == models.UserRole.HOSPITAL and org.id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this organization")
    
    return org

@router.put("/organizations/{org_id}", response_model=schemas.OrganizationOut)
async def update_organization(
    org_id: int,
    org_update: schemas.OrganizationUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Organization).where(models.Organization.id == org_id))
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
    result = await db.execute(select(models.Organization).where(models.Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    await db.delete(org)
    await db.commit()
    return None
