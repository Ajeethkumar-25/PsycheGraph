from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from .. import models, schemas, auth, dependencies, database

router = APIRouter(tags=["Admin"])

# Super Admin: Create Organization
@router.post("/organizations", response_model=schemas.OrganizationOut)
async def create_organization(
    org: schemas.OrganizationCreate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    new_org = models.Organization(name=org.name, license_key=org.license_key)
    db.add(new_org)
    try:
        await db.commit()
        await db.refresh(new_org)
        return new_org
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Organization already exists")

# Super Admin & HOSPITAL: Create User
@router.post("/users", response_model=schemas.UserWithToken)
async def create_user(
    user: schemas.UserCreate,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    # Logic: 
    # SUPER_ADMIN can only create HOSPITAL admin
    # HOSPITAL can only create DOCTORs and RECEPTIONISTs for THEIR OWN Organization
    
    if current_user.role == models.UserRole.SUPER_ADMIN:
        if user.role != models.UserRole.HOSPITAL:
             raise HTTPException(status_code=403, detail="Super Admin can only create Hospital Admin accounts")
    elif current_user.role == models.UserRole.HOSPITAL:
        if user.role not in [models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST]:
             raise HTTPException(status_code=403, detail="Hospital Admins can only create Doctors and Receptionists")
        if user.organization_id != current_user.organization_id:
             raise HTTPException(status_code=403, detail="Cannot create user for another organization")
    else:
        raise HTTPException(status_code=403, detail="Not authorized to create users")

    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        role=user.role,
        organization_id=user.organization_id
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
        
        # Generate tokens for the new user
        from datetime import timedelta
        access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        # Ensure role is string for JWT
        role_str = new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role)
        
        access_token = auth.create_access_token(
            data={"sub": new_user.email, "role": role_str},
            expires_delta=access_token_expires
        )
        refresh_token = auth.create_refresh_token(
            data={"sub": new_user.email, "role": role_str}
        )
        
        # Construct response manually to include tokens + user fields
        return schemas.UserWithToken(
            id=new_user.id,
            email=new_user.email,
            full_name=new_user.full_name,
            role=new_user.role,
            organization_id=new_user.organization_id,
            is_active=new_user.is_active,
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
    except Exception as e:
        await db.rollback()
        # Print error to logs for debugging
        print(f"Error creating user: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error creating user: {str(e)}")

@router.get("/users/", response_model=List[schemas.UserOut])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    organization_id: Optional[int] = None,
    role: Optional[models.UserRole] = None,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User)
    if current_user.role == models.UserRole.SUPER_ADMIN:
        if organization_id:
            query = query.where(models.User.organization_id == organization_id)
        if role:
            query = query.where(models.User.role == role)
    elif current_user.role == models.UserRole.HOSPITAL:
        # Hospital admin can only see Doctors and Receptionists in their org
        query = query.where(
            models.User.organization_id == current_user.organization_id,
            models.User.role.in_([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST])
        )
    else:
        raise HTTPException(status_code=403, detail="Not authorized to list users")
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/users/{user_id}", response_model=schemas.UserOut)
async def get_user(
    user_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).where(models.User.id == user_id)
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass # sees all
    elif current_user.role == models.UserRole.HOSPITAL:
        # Hospital admin can only see Doctors and Receptionists in their org
        query = query.where(
            models.User.organization_id == current_user.organization_id,
            models.User.role.in_([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST])
        )
    else:
        # Doctors/Receptionists can only see themselves
        if user_id != current_user.id:
             raise HTTPException(status_code=403, detail="Not authorized to view this user")
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/users/{user_id}", response_model=schemas.UserOut)
async def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).where(models.User.id == user_id)
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass # full access
    elif current_user.role == models.UserRole.HOSPITAL:
        # Can only update Doctors/Receptionists in their org
        query = query.where(
            models.User.organization_id == current_user.organization_id,
            models.User.role.in_([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST])
        )
    else:
        # Doctors/Receptionists can only update themselves (if allowed by dependencies, but here it's restricted to ADMIN/HOSPITAL)
        # But per requirements "PUT own data by doctor/receptionist"
        if user_id != current_user.id:
             raise HTTPException(status_code=403, detail="Not authorized to update this user")
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(update_data.pop("password"))
        
    for key, value in update_data.items():
        setattr(user, key, value)
        
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).where(models.User.id == user_id)
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        # Can only delete Doctors/Receptionists in their org
        query = query.where(
            models.User.organization_id == current_user.organization_id,
            models.User.role.in_([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST])
        )
    else:
        raise HTTPException(status_code=403, detail="Not authorized to delete users")
        
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
         raise HTTPException(status_code=404, detail="User not found")
         
    await db.delete(user)
    await db.commit()
    return None

# Organization CRUD
@router.get("/organizations/", response_model=List[schemas.OrganizationOut])
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
