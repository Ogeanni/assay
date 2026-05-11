"""
Database session management.

Design decisions:
- AsyncSession throughout — no sync sessions in the codebase
- Session is created per-request via FastAPI dependency injection
- Connection pool is managed by SQLAlchemy — not manually
- Engine is created once at startup, not per request
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator


def create_engine(database_url: str, is_test: bool = False):
    """
    Create async engine.

    NullPool for test environments — each test gets a clean connection,
    no pooling interference between tests.

    For production: default pool (5 connections, 10 overflow) is sufficient
    for Phase 1 load. Tune when metrics justify it.
    """
    # Neon requires asyncpg driver
    url = database_url.replace("postgresql://", "postgresql+asyncpg://")

    if is_test:
        return create_async_engine(url, poolclass=NullPool, echo=False)

    return create_async_engine(
        url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,  # verify connection health before use
        echo=False,
    )


def create_session_factory(engine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,  # objects remain accessible after commit
    )


async def get_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency — yields a session and handles commit/rollback.
    Usage: session: AsyncSession = Depends(get_db)
    """
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise