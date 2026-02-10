from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import timedelta
from .. import models, schemas, auth, database

router = APIRouter(tags=["Authentication"])

@router.post("/token", response_model=schemas.UserWithToken)
async def login_for_access_token(user_credentials: schemas.UserLogin, db: AsyncSession = Depends(database.get_db)):
    # Authenticate user
    result = await db.execute(select(models.User).where(models.User.email == user_credentials.email))
    user = result.scalars().first()
    
    if not user or not auth.verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Ensure role is string for JWT
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    
    # Create token
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": role_str},
        expires_delta=access_token_expires
    )
    refresh_token = auth.create_refresh_token(
        data={"sub": user.email, "role": role_str}
    )
    
    return schemas.UserWithToken(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        organization_id=user.organization_id,
        is_active=user.is_active,
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/token/refresh", response_model=schemas.UserWithToken)
async def refresh_access_token(token_data: schemas.TokenRefresh, db: AsyncSession = Depends(database.get_db)):
    try:
        payload = jwt.decode(token_data.refresh_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
            
        # Verify user still exists
        result = await db.execute(select(models.User).where(models.User.email == email))
        user = result.scalars().first()
        if not user:
             raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
             
        # Ensure role is string for JWT
        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
             
        # Create new access token
        access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth.create_access_token(
            data={"sub": user.email, "role": role_str},
            expires_delta=access_token_expires
        )
        # Optionally rotate refresh token here
        new_refresh_token = auth.create_refresh_token(
            data={"sub": user.email, "role": role_str}
        )
        
        return schemas.UserWithToken(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            organization_id=user.organization_id,
            is_active=user.is_active,
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
