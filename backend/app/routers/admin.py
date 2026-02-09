from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
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

# Super Admin & Admin: Create User
@router.post("/users", response_model=schemas.UserOut)
async def create_user(
    user: schemas.UserCreate,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    # Logic: 
    # SUPER_ADMIN can create ADMINs (and other roles if needed, but primarily Admins for Orgs)
    # ADMIN can create DOCTORs and RECEPTIONISTs for THEIR OWN Organization
    
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass # Can create anyone
    elif current_user.role == models.UserRole.ADMIN:
        if user.role in [models.UserRole.SUPER_ADMIN, models.UserRole.ADMIN]:
             raise HTTPException(status_code=403, detail="Admins cannot create other Admins or Super Admins")
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
        return new_user
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")

@router.get("/users/", response_model=List[schemas.UserOut])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User)
    if current_user.role != models.UserRole.SUPER_ADMIN:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
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
    if current_user.role != models.UserRole.SUPER_ADMIN:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/users/{user_id}", response_model=schemas.UserOut)
async def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).where(models.User.id == user_id)
    if current_user.role != models.UserRole.SUPER_ADMIN:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
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
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).where(models.User.id == user_id)
    if current_user.role != models.UserRole.SUPER_ADMIN:
        query = query.where(models.User.organization_id == current_user.organization_id)
        
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
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Organization).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/organizations/{org_id}", response_model=schemas.OrganizationOut)
async def get_organization(
    org_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Organization).where(models.Organization.id == org_id))
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
