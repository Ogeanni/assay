from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, EmailStr
import logging
import secrets
import httpx
from datetime import datetime, timedelta, timezone

from authlib.integrations.starlette_client import OAuth
from starlette.requests import Request
from starlette.responses import RedirectResponse

from apps.api.config import settings
from apps.api.dependencies import get_current_user, get_db
from packages.db.models import User
from apps.api.auth import hash_password, verify_password, create_access_token

oauth = OAuth()
oauth.register(
    name='google',
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
 
LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo"


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


# ── Google ────────────────────────────────────────────
 
# @router.get("/google")
# async def google_login():
#     params = {
#         "client_id": settings.GOOGLE_CLIENT_ID,
#         "redirect_uri": f"{settings.BACKEND_URL}/auth/google/callback",
#         "response_type": "code",
#         "scope": "openid email profile",
#         "access_type": "offline",
#         "prompt": "select_account",  # forces account picker every time
#     }
#     url = GOOGLE_AUTH_URL + "?" + "&".join(f"{k}={v}" for k, v in params.items())
#     return RedirectResponse(url)

@router.get("/google")
async def google_login(request: Request):
    redirect_uri = f"{settings.BACKEND_URL}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)




@router.get("/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
        userinfo = token.get('userinfo')
        if not userinfo:
            raise HTTPException(status_code=400, detail="Could not get user info from Google")

        email = userinfo.get('email')
        full_name = userinfo.get('name')
        google_id = userinfo.get('sub')

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")

        # Check if user exists
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            # Create new user
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(secrets.token_hex(32)),
                google_id=google_id,
                email_verified=True,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            if not user.google_id:
                user.google_id = google_id
                db.add(user)
                await db.commit()

        access_token = create_access_token(str(user.id))
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        return RedirectResponse(
            url=f"{frontend_url}/auth/callback?token={access_token}"
        )

    except Exception as e:
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        return RedirectResponse(
            url=f"{frontend_url}/login?error=google_auth_failed"
        )


# @router.get("/google/callback")
# async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
#     try:
#         async with httpx.AsyncClient() as client:
#             # Exchange code for token
#             token_res = await client.post(GOOGLE_TOKEN_URL, data={
#                 "code": code,
#                 "client_id": settings.GOOGLE_CLIENT_ID,
#                 "client_secret": settings.GOOGLE_CLIENT_SECRET,
#                 "redirect_uri": f"{settings.BACKEND_URL}/auth/google/callback",
#                 "grant_type": "authorization_code",
#             })
#             token_data = token_res.json()
#             access_token = token_data.get("access_token")
 
#             if not access_token:
#                 raise HTTPException(status_code=400, detail="Failed to get access token from Google")
 
#             # Get user info
#             userinfo_res = await client.get(
#                 GOOGLE_USERINFO_URL,
#                 headers={"Authorization": f"Bearer {access_token}"}
#             )
#             userinfo = userinfo_res.json()
 
#         email = userinfo.get("email")
#         name = userinfo.get("name", email.split("@")[0])
 
#         if not email:
#             raise HTTPException(status_code=400, detail="No email returned from Google")
 
#         # Find or create user
#         result = await db.execute(select(User).where(User.email == email))
#         user = result.scalar_one_or_none()
 
#         if not user:
#             user = User(
#                 name=name,
#                 email=email,
#                 hashed_password=hash_password(secrets.token_hex(16)),
#                 onboarding_completed=False,
#             )
#             db.add(user)
#             await db.flush()
#             is_new = True
#         else:
#             is_new = False
 
#         jwt = create_access_token(str(user.id))
#         redirect = f"{settings.FRONTEND_URL}/oauth/callback?token={jwt}&new={str(is_new).lower()}"
#         return RedirectResponse(redirect)
 
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Google OAuth error: {e}", exc_info=True)
#         return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=google_failed")
 


# ── LinkedIn ──────────────────────────────────────────
 
@router.get("/linkedin")
async def linkedin_login():
    params = {
        "response_type": "code",
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "redirect_uri": f"{settings.BACKEND_URL}/auth/linkedin/callback",
        "scope": "openid profile email",
    }
    url = LINKEDIN_AUTH_URL + "?" + "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url)


@router.get("/linkedin/callback")
async def linkedin_callback(code: str, db: AsyncSession = Depends(get_db)):
    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for token
            token_res = await client.post(LINKEDIN_TOKEN_URL, data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": f"{settings.BACKEND_URL}/auth/linkedin/callback",
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
            }, headers={"Content-Type": "application/x-www-form-urlencoded"})
            token_data = token_res.json()
            access_token = token_data.get("access_token")
 
            if not access_token:
                raise HTTPException(status_code=400, detail="Failed to get access token from LinkedIn")
 
            # Get user info using OpenID Connect endpoint
            userinfo_res = await client.get(
                LINKEDIN_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            userinfo = userinfo_res.json()
 
        email = userinfo.get("email")
        name = userinfo.get("name") or f"{userinfo.get('given_name','')} {userinfo.get('family_name','')}".strip()
 
        if not email:
            raise HTTPException(status_code=400, detail="No email returned from LinkedIn")
 
        # Find or create user
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
 
        if not user:
            user = User(
                name=name or email.split("@")[0],
                email=email,
                hashed_password=hash_password(secrets.token_hex(16)),
                onboarding_completed=False,
            )
            db.add(user)
            await db.flush()
            is_new = True
        else:
            is_new = False
 
        jwt = create_access_token(str(user.id))
        redirect = f"{settings.FRONTEND_URL}/oauth/callback?token={jwt}&new={str(is_new).lower()}"
        return RedirectResponse(redirect)
 
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LinkedIn OAuth error: {e}", exc_info=True)
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=linkedin_failed")
 






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