from typing import AsyncGenerator
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt
import uuid

from packages.db.models import User
from packages.db.repository import UserRepository
from apps.api.config import settings

security = HTTPBearer()


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session. Commits on success, rolls back on error."""
    session_factory = request.app.state.session_factory
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate JWT and return the authenticated user.
    Raises 401 if token is invalid or user not found.
    """

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    repo = UserRepository(session)
    user = await repo.get_by_id(uuid.UUID(user_id))

    if not user or not user.is_active:
        raise credentials_exception

    return user