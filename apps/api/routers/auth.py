from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, EmailStr
import logging

import secrets
from datetime import datetime, timedelta, timezone

from apps.api.dependencies import get_current_user, get_db
from packages.db.models import User
from apps.api.auth import hash_password, verify_password, create_access_token

logger = logging.getLogger(__name__)



async def send_reset_email(email: str, name: str, token: str) -> None:
    """
    Send password reset email via Resend.
    Import is inside the function so the app starts even if Resend is not configured.
    """
    from apps.api.config import settings
    import httpx

    if not settings.RESEND_API_KEY:
        # Log the token to terminal in development
        logger.info(f"[DEV] Password reset token for {email}: {token}")
        logger.info(f"[DEV] Reset URL: {settings.FRONTEND_URL}/reset-password?token={token}")
        return

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": "ASSAY <noreply@yourdomain.com>",
                "to": [email],
                "subject": "Reset your ASSAY password",
                "html": f"""
                    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                        <p style="font-size: 14px; color: #71717a;">ASSAY</p>
                        <h2 style="font-size: 20px; font-weight: 600; color: #0a0a0a;">
                            Reset your password
                        </h2>
                        <p style="font-size: 14px; color: #52525b;">
                            Hi {name}, we received a request to reset your password.
                            Click the link below — it expires in 2 hours.
                        </p>
                        <a href="{reset_url}"
                           style="display: inline-block; background: #0a0a0a; color: white;
                                  padding: 10px 20px; border-radius: 6px; text-decoration: none;
                                  font-size: 14px; font-weight: 500; margin: 16px 0;">
                            Reset password
                        </a>
                        <p style="font-size: 12px; color: #a1a1aa;">
                            If you didn't request this, ignore this email.
                            Your password won't change.
                        </p>
                    </div>
                """,
            },
        )
        if response.status_code != 200:
            logger.error(f"Resend error: {response.text}")

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_bearer: str = "bearer"

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    access_token = create_access_token(str(user.id))
    return TokenResponse(access_token=access_token)
    

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(str(user.id))
    return TokenResponse(access_token=access_token)


@router.post("/onboarding-complete", status_code=status.HTTP_200_OK)
async def complete_onboarding(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await db.execute(update(User).where(User.id == current_user.id).values(onboarding_completed=True))

    return {"message": "Onboarding complete."}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "onboarding_completed": current_user.onboarding_completed,
    }


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db),):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always return 200 — never reveal if email exists
    if not user:
        return {"message": "If that email exists, a reset link has been sent."}

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=2)

    await db.execute(
        update(User).where(User.id == user.id)
        .values(reset_token=token, reset_token_expires=expires)
    )

    await send_reset_email(user.email, user.name, token)

    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db),):
    result = await db.execute(select(User).where(User.reset_token == body.token))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    if user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset link has expired. Request a new one.")

    await db.execute(
        update(User).where(User.id == user.id)
        .values(
            hashed_password=hash_password(body.password),
            reset_token=None,
            reset_token_expires=None,
        )
    )

    return {"message": "Password reset successfully. You can now sign in."}