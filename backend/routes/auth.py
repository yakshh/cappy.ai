"""
routes/auth.py — Registration and login endpoints.
"""

from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user, hash_password, verify_password
from config import settings
from database import get_db, ensure_db_schema
from models.user import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    field: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account and return a JWT token."""
    try:
        ensure_db_schema()
        clean_email = payload.email.lower().strip()
        clean_name = payload.full_name.strip()
        clean_field = payload.field.strip() if payload.field else None

        if not clean_email or "@" not in clean_email or "." not in clean_email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please provide a valid email address.",
            )

        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please provide your full name.",
            )

        if not clean_field:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please provide your Field / Stream of study.",
            )

        if len(payload.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Password must be at least 8 characters.",
            )

        existing = db.query(User).filter(User.email == clean_email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )

        pwd_hash = hash_password(payload.password)
        new_user = User(
            full_name=clean_name,
            email=clean_email,
            field=clean_field,
            hashed_password=pwd_hash,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        token = create_access_token(
            data={"sub": new_user.email},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": new_user.id,
                "full_name": new_user.full_name,
                "email": new_user.email,
                "field": new_user.field,
                "created_at": new_user.created_at.isoformat() if hasattr(new_user.created_at, 'isoformat') else str(new_user.created_at),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[Register Error]: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT token."""
    try:
        ensure_db_schema()
        clean_email = payload.email.lower().strip()
        user = db.query(User).filter(User.email == clean_email).first()

        if not user or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact support.",
            )

        token = create_access_token(
            data={"sub": user.email},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "field": user.field,
                "created_at": user.created_at.isoformat() if hasattr(user.created_at, 'isoformat') else str(user.created_at),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[Login Error]: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "field": current_user.field,
        "created_at": current_user.created_at.isoformat(),
    }
