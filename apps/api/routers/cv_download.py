import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.dependencies import get_db, get_current_user
from packages.db.models import User
from packages.db.repository import ReportRepository, ResumeRepository
from packages.core.schemas.depth import DepthScore
from packages.core.schemas.report import GapItem, PositioningBrief
from packages.core.schemas.resume import ResumeProfile
from packages.pipeline.cv_assembler import build_docx_cv

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cv", tags=["cv"])


@router.get("/download/{report_id}")
async def download_cv(
    report_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate and download a rewritten CV as DOCX for a given report.
    """
    repo = ReportRepository(session)
    resume_repo = ResumeRepository(session)

    try:
        report_uuid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report ID.")

    report = await repo.get_by_id(report_uuid)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    if str(report.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied.")

    # Get the resume profile
    resume = await resume_repo.get_by_id(report.resume_id)
    if not resume or not resume.parsed_profile:
        raise HTTPException(status_code=404, detail="Resume data not found.")

    # Reconstruct profile
    try:
        profile = ResumeProfile(**resume.parsed_profile)
    except Exception as e:
        logger.error(f"Failed to reconstruct profile: {e}")
        raise HTTPException(status_code=500, detail="Could not reconstruct resume profile.")

    # Get rewrites and summary from report
    rewrites = report.gaps_detail.get("rewrites", []) if hasattr(report, 'gaps_detail') else []

    # Try to get rewrites from the report JSONB — check positioning field
    rewrites = []
    summary_rewrite = None

    # The report stores rewrites in the positioning JSONB
    if report.positioning and isinstance(report.positioning, dict):
        rewrites = report.positioning.get("rewrites", [])
        summary_rewrite = report.positioning.get("summary_rewrite")

    # Generate DOCX
    try:
        docx_bytes = build_docx_cv(
            profile=profile,
            rewrites=rewrites,
            summary_rewrite=summary_rewrite,
            target_role=report.target_role,
        )
    except Exception as e:
        logger.error(f"DOCX generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="CV generation failed.")

    filename = f"CV_{report.target_role.replace(' ', '_')}_{report_id[:8]}.docx"

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )