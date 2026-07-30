"""
routes/users.py — User profile management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional

from auth import get_current_user, hash_password, verify_password
from database import get_db
from models.user import User

router = APIRouter(prefix="/api/users", tags=["Users"])


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/me")
def get_profile(current_user: User = Depends(get_current_user)):
    """Return the current user's profile."""
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url,
        "created_at": current_user.created_at.isoformat(),
    }


@router.patch("/me")
def update_profile(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update name, email, or avatar URL."""
    if payload.full_name:
        current_user.full_name = payload.full_name.strip()

    if payload.email:
        new_email = payload.email.lower().strip()
        if new_email != current_user.email:
            existing = db.query(User).filter(User.email == new_email, User.id != current_user.id).first()
            if existing:
                raise HTTPException(status_code=409, detail="An account with this email address already exists.")
            current_user.email = new_email

    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url

    db.commit()
    db.refresh(current_user)

    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url,
    }


@router.post("/me/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the authenticated user's password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters.")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully."}
