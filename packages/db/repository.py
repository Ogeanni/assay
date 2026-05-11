"""
Repository layer — the only place in ASSAY that writes SQL.

Design decisions:
- No raw SQL anywhere else in the codebase. Agents, routers, and services
  call repository methods. They never import Session or write queries.
- Each repository class owns one table. No cross-table queries inside a
  repository — that belongs in a service layer if needed.
- All methods are async — SQLAlchemy 2.0 async session throughout.
- Pydantic models are serialized to dict before storage and deserialized
  on read. The repository handles this translation — callers work with
  Pydantic objects, not raw dicts.
- Soft deletes on User — hard_delete is a separate explicit method.
"""

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from packages.core.schemas.resume import ResumeProfile
from packages.core.schemas.depth import DepthScore
from packages.core.schemas.report import AssayReport, GapItem, PositioningBrief
from packages.db.models import User, Resume, AssayReport as AssayReportModel, AuditLog


# ---------------------------------------------------------------------------
# User Repository
# ---------------------------------------------------------------------------

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        name: str,
        email: str,
        hashed_password: str,
    ) -> User:
        user = User(
            name=name,
            email=email,
            hashed_password=hashed_password,
        )
        self.session.add(user)
        await self.session.flush()  # get id without committing
        return user

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(
                User.id == user_id,
                User.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(
                User.email == email,
                User.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def verify_email(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(User)
            .where(User.id == user_id)
            .values(is_verified=True)
        )

    async def soft_delete(self, user_id: uuid.UUID) -> None:
        """GDPR-safe soft delete. Use hard_delete for full removal."""
        await self.session.execute(
            update(User)
            .where(User.id == user_id)
            .values(deleted_at=datetime.now(timezone.utc))
        )

    async def hard_delete(self, user_id: uuid.UUID) -> None:
        """
        Permanent deletion — only on explicit GDPR request.
        Cascades to resumes and reports via FK constraints.
        AuditLog rows are intentionally preserved (no FK).
        """
        user = await self.get_by_id(user_id)
        if user:
            await self.session.delete(user)


# ---------------------------------------------------------------------------
# Resume Repository
# ---------------------------------------------------------------------------

class ResumeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def hash_pdf(pdf_bytes: bytes) -> str:
        """SHA-256 hash of PDF bytes for deduplication."""
        return hashlib.sha256(pdf_bytes).hexdigest()

    async def create(
        self,
        user_id: uuid.UUID,
        pdf_bytes: bytes,
        profile: ResumeProfile,
        original_filename: Optional[str] = None,
        file_url: Optional[str] = None,
    ) -> Resume:
        file_hash = self.hash_pdf(pdf_bytes)

        # Calculate average parser confidence across projects
        confidences = [p.parser_confidence for p in profile.projects]
        avg_confidence = sum(confidences) / len(confidences) if confidences else None

        understatement = any(p.understatement_detected for p in profile.projects)

        resume = Resume(
            user_id=user_id,
            file_url=file_url,
            file_hash=file_hash,
            original_filename=original_filename,
            raw_text=profile.raw_text,
            parsed_profile=profile.model_dump(),
            parse_confidence=avg_confidence,
            understatement_detected=understatement,
        )
        self.session.add(resume)
        await self.session.flush()
        return resume

    async def get_by_id(self, resume_id: uuid.UUID) -> Optional[Resume]:
        result = await self.session.execute(
            select(Resume).where(Resume.id == resume_id)
        )
        return result.scalar_one_or_none()

    async def get_by_hash(
        self,
        user_id: uuid.UUID,
        file_hash: str,
    ) -> Optional[Resume]:
        """
        Check if this user has already uploaded this exact PDF.
        Returns the existing Resume if found — caller can skip re-parsing.
        """
        result = await self.session.execute(
            select(Resume).where(
                Resume.user_id == user_id,
                Resume.file_hash == file_hash,
            )
        )
        return result.scalar_one_or_none()

    async def get_profile(self, resume_id: uuid.UUID) -> Optional[ResumeProfile]:
        """
        Retrieve and deserialize the parsed profile from JSONB.
        Returns None if resume not found or not yet parsed.
        """
        resume = await self.get_by_id(resume_id)
        if not resume or not resume.parsed_profile:
            return None
        return ResumeProfile.model_validate(resume.parsed_profile)

    async def list_by_user(self, user_id: uuid.UUID) -> list[Resume]:
        result = await self.session.execute(
            select(Resume)
            .where(Resume.user_id == user_id)
            .order_by(Resume.created_at.desc())
        )
        return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Report Repository
# ---------------------------------------------------------------------------

class ReportRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        resume_id: uuid.UUID,
        report: AssayReport,
    ) -> AssayReportModel:
        row = AssayReportModel(
            id=uuid.UUID(report.report_id),
            user_id=user_id,
            resume_id=resume_id,
            target_role=report.target_role,

            # Scalar depth score — duplicated for query performance
            depth_score=report.depth_score.depth_score,
            depth_label=report.depth_score.label.value,

            # Full nested detail — JSONB
            depth_score_detail=report.depth_score.model_dump(),
            gaps=[gap.model_dump() for gap in report.gaps],
            positioning=report.positioning.model_dump(),

            signal_note=report.signal_note,
            model_version=report.model_version,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def get_by_id(self, report_id: uuid.UUID) -> Optional[AssayReportModel]:
        result = await self.session.execute(
            select(AssayReportModel).where(AssayReportModel.id == report_id)
        )
        return result.scalar_one_or_none()

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        limit: int = 20,
    ) -> list[AssayReportModel]:
        result = await self.session.execute(
            select(AssayReportModel)
            .where(AssayReportModel.user_id == user_id)
            .order_by(AssayReportModel.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_resume_and_role(
        self,
        resume_id: uuid.UUID,
        target_role: str,
        model_version: Optional[str] = None,
    ) -> Optional[AssayReportModel]:
        """
        Check if a report already exists for this resume + target role + model version.
        When model_version is provided, only returns reports matching that version.
        This ensures prompt changes invalidate cached reports automatically.
        """
        conditions = [
            AssayReportModel.resume_id == resume_id,
            AssayReportModel.target_role == target_role,
        ]

        if model_version:
            conditions.append(AssayReportModel.model_version == model_version)

        result = await self.session.execute(
            select(AssayReportModel).where(*conditions)
        )
        return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Audit Log Repository
# ---------------------------------------------------------------------------

class AuditLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def log(
        self,
        event: str,
        user_id: Optional[uuid.UUID] = None,
        resume_id: Optional[uuid.UUID] = None,
        report_id: Optional[uuid.UUID] = None,
        latency_ms: Optional[int] = None,
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        estimated_cost_usd: Optional[float] = None,
        model_version: Optional[str] = None,
        error_type: Optional[str] = None,
        error_message: Optional[str] = None,
        meta_data: Optional[dict] = None,
    ) -> AuditLog:
        entry = AuditLog(
            event=event,
            user_id=user_id,
            resume_id=resume_id,
            report_id=report_id,
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost_usd=estimated_cost_usd,
            model_version=model_version,
            error_type=error_type,
            error_message=error_message,
            meta_data=meta_data,
        )
        self.session.add(entry)
        await self.session.flush()
        return entry