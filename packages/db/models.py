import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Text,
    Boolean,
    Integer,
    Float,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass



class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    auth_provider: Mapped[str] = mapped_column(String(50), default="email", nullable=False, server_default="email")

    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False,)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,)
    # Soft delete — hard delete only on explicit GDPR request
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True, default=None,)

    # Password reset
    reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    reset_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    # Relationships
    resumes: Mapped[list["Resume"]] = relationship(back_populates="user", cascade="all, delete-orphan",)


    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
    

class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="cascade"), nullable=False)

    # File reference — PDF stored in object storage, not the database
    # Format: s3://bucket/user_id/resume_id.pdf or equivalent
    file_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Deduplication — sha256 hash of the PDF bytes
    # Prevents re-parsing an identical upload
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Raw extracted text — preserved for agent reference and debugging
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Structured parser output — full ResumeProfile Pydantic model serialized
    # Never queried inside — always read as a whole and deserialized
    parsed_profile: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Parser metadata
    parser_version: Mapped[str] = mapped_column(String(50), default="1.0", nullable=False)
    parser_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    understatement_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False,)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="resumes")
    reports: Mapped[list["AssayReport"]] = relationship(back_populates="resume", cascade="all, delete-orphan",)

    __table_args__ = (
        # A user should not have two identical resumes
        UniqueConstraint("user_id", "file_hash", name="uq_user_resume_hash"),
        # Common query: all resumes for a user, newest first
        Index("ix_resumes_user_id_created_at", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Resume id={self.id} user_id={self.user_id}>"
    

class AssayReport(Base):
    __tablename__ = "assay_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,)
    resume_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False,)

    # The role the candidate was assessed against
    # Same resume + different target_role = different report
    target_role: Mapped[str] = mapped_column(String(255), nullable=False)
 
    # Composite depth score — top-level scalar for quick queries
    # Duplicated from depth_score JSONB for query performance
    depth_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    depth_label: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Full nested output — stored as JSONB, deserialized to Pydantic on read
    # These are always read as a whole — JSONB is correct here
    depth_score_detail: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    gaps: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    positioning: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Rewriter agent output
    rewrites: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    summary_rewrite: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Signal completeness — shown to user
    signal_note: Mapped[str | None] = mapped_column(Text, nullable=True)
 
    # Model provenance — what generated this report
    model_version: Mapped[str] = mapped_column(String(50), default="gpt-4o", nullable=False)
 
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False,)
 
    # Relationships
    resume: Mapped["Resume"] = relationship(back_populates="reports")

    __table_args__ = (
        # Most common query: all reports for a user, newest first
        Index("ix_assay_reports_user_id_created_at", "user_id", "created_at"),
        # Retrieve a specific report for a resume + role combination
        Index("ix_assay_reports_resume_target", "resume_id", "target_role"),
    )
 
    def __repr__(self) -> str:
        return (f"<AssayReport id={self.id} " f"target_role={self.target_role} "f"depth_score={self.depth_score}>")
    

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,)
 
    # Intentionally no FK to users — logs survive user deletion
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True,)
    resume_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True,)
    report_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True,)
 
    # What happened
    event: Mapped[str] = mapped_column(String(100), nullable=False)
    # Examples: "resume.parsed", "report.generated", "report.failed", "user.registered"
 
    # Pipeline operational data
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
 
    # Error capture — null if success
    error_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
 
    # Any additional context — flexible JSONB
    meta_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
 
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False,)
 
    __table_args__ = (
        # Operational queries: all logs for a report, all errors today
        Index("ix_audit_logs_report_id", "report_id"),
        Index("ix_audit_logs_event_created_at", "event", "created_at"),
        Index("ix_audit_logs_user_id", "user_id"),
    )
 
    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} event={self.event}>"
