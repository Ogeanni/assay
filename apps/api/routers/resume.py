from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
import logging

from apps.api.dependencies import get_db, get_current_user
from packages.db.repository import ResumeRepository, ReportRepository, AuditLogRepository
from packages.db.models import User
from packages.pipeline.agents.state import AssayState
from packages.core.schemas.depth import DepthScore
from packages.core.schemas.report import ReportResponse, GapItem, PositioningBrief

logger = logging.getLogger(__name__)

# Bump this when prompts change to invalidate cached reports
MODEL_VERSION = "v1.0"

router = APIRouter(prefix="/resume", tags=["resume"])


@router.post("/analyze")
async def analyze_resume(
    request: Request,
    file: UploadFile = File(...),
    target_role: str = Form(...),
    job_description: Optional[str] = Form(None),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    pdf_bytes = await file.read()

    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(pdf_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5MB.")

    resume_repo = ResumeRepository(session)
    report_repo = ReportRepository(session)
    audit_repo = AuditLogRepository(session)

    # Check 1 — has this exact PDF been uploaded before?
    file_hash = ResumeRepository.hash_pdf(pdf_bytes)
    existing_resume = await resume_repo.get_by_hash(current_user.id, file_hash)

    if existing_resume:
        profile = await resume_repo.get_profile(existing_resume.id)
        logger.info(f"Resume cache hit: {existing_resume.id}")
    else:
        parser = request.app.state.parser
        profile = await parser.parse(pdf_bytes, target_role)
        existing_resume = await resume_repo.create(
            user_id=current_user.id,
            pdf_bytes=pdf_bytes,
            profile=profile,
            original_filename=file.filename,
        )
        logger.info(f"Resume parsed and stored: {existing_resume.id}")

    # Check 2 — has this resume already been analyzed for this target role?
    existing_report = await report_repo.get_by_resume_and_role(
        existing_resume.id, target_role, model_version=MODEL_VERSION
    )

    if existing_report:
        logger.info(f"Report cache hit: {existing_report.id}")
        return ReportResponse(
            report_id=str(existing_report.id),
            target_role=existing_report.target_role,
            created_at=existing_report.created_at,
            depth_score=DepthScore(**existing_report.depth_score_detail),
            gaps=[GapItem(**g) for g in existing_report.gaps],
            positioning=PositioningBrief(**existing_report.positioning),
            signal_note=existing_report.signal_note,
        )

    # Run the full pipeline
    graph = request.app.state.graph

    initial_state: AssayState = {
        "messages": [],
        "target_role": target_role,
        "profile": profile,
        "job_description": job_description,
    }

    final_state = await graph.ainvoke(initial_state)

    if final_state.get("error"):
        error = final_state["error"]
        raise HTTPException(
            status_code=500,
            detail=f"{error.agent} failed: {error.message}"
        )

    report = final_state["report"]

    # Persist report to database
    await report_repo.create(
        user_id=current_user.id,
        resume_id=existing_resume.id,
        report=report,
    )

    await audit_repo.log(
        event="report.generated",
        user_id=current_user.id,
        resume_id=existing_resume.id,
        report_id=report.report_id,
    )

    return ReportResponse(
        report_id=report.report_id,
        target_role=report.target_role,
        created_at=report.created_at,
        depth_score=report.depth_score,
        gaps=report.gaps,
        positioning=report.positioning,
        signal_note=report.signal_note,
    )