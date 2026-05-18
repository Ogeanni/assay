import json
import logging
import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.dependencies import get_db, get_current_user
from packages.db.models import User
from packages.db.repository import ResumeRepository, ReportRepository
from packages.pipeline.agents.state import AssayState
from packages.core.schemas.depth import DepthScore
from packages.core.schemas.report import ReportResponse, GapItem, PositioningBrief

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/report", tags=["report"])


def format_event(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


@router.get("/history", response_model=None)
async def report_history(session: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    repo = ReportRepository(session)
    reports = await repo.list_by_user(current_user.id, limit=100)

    groups = {}
    for r in reports:
        role = r.target_role
        if role not in groups:
            groups[role] = []
        groups[role].append({
            "id": str(r.id),
            "depth_score": r.depth_score,
            "depth_label": r.depth_label,
            "created_at": r.created_at.isoformat(),
        })

    result = []
    for role, version in groups.items():
        versions_sorted = sorted(version, key=lambda v: v["created_at"])
        first_score = versions_sorted[0]["depth_score"]
        latest_score = versions_sorted[-1]["depth_score"]
        improvement = round(latest_score - first_score, 1)
        latest = versions_sorted[-1]

        result.append({
            "target_role": role,
            "versions": versions_sorted,
            "version_count": len(versions_sorted),
            "first_score": first_score,
            "latest_score": latest_score,
            "latest_label": latest["depth_label"],
            "latest_report_id": latest["id"],
            "latest_created_at": latest["created_at"],
            "improvement": improvement,
        })

    result.sort(key=lambda g: g["latest_created_at"], reverse=True)
    return result


@router.get("/list", response_model=None)
async def list_reports(
    request: Request,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ReportRepository(session)
    reports = await repo.list_by_user(current_user.id)
    return [
        {
            "id": str(r.id),
            "target_role": r.target_role,
            "depth_score": r.depth_score,
            "depth_label": r.depth_label,
            "created_at": r.created_at.isoformat(),
        }
        for r in reports
    ]


@router.get("/{report_id}", response_model=None)
async def get_report(
    report_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(f"Fetching report: {report_id!r}")
    repo = ReportRepository(session)

    try:
        report_uuid = uuid.UUID(report_id)
    except ValueError:
        logger.error(f"Invalid UUID: {report_id!r}")
        raise HTTPException(status_code=400, detail="Invalid report ID.")

    report = await repo.get_by_id(report_uuid)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    if str(report.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied.")

    return ReportResponse(
        report_id=str(report.id),
        target_role=report.target_role,
        created_at=report.created_at,
        depth_score=DepthScore(**report.depth_score_detail),
        gaps=[GapItem(**g) for g in report.gaps],
        rewrites=report.rewrites or [],
        summary_rewrite=report.summary_rewrite,
        summary_placeholders=getattr(report, 'summary_placeholders', None) or [],
        positioning=PositioningBrief(**report.positioning),
        signal_note=report.signal_note,
    )


@router.get("/stream", response_model=None)
async def stream_report(
    request: Request,
    resume_id: str,
    target_role: str,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async def generate():
        yield format_event("progress", {"message": "Connected. Starting analysis..."})

        resume_repo = ResumeRepository(session)
        resume = await resume_repo.get_by_id(uuid.UUID(resume_id))
        if not resume:
            yield format_event("error", {"message": "Resume not found"})
            return

        profile = await resume_repo.get_profile(uuid.UUID(resume_id))
        yield format_event("progress", {"message": "Resume loaded. Scoring depth..."})

        graph = request.app.state.graph
        initial_state: AssayState = {
            "messages": [],
            "target_role": target_role,
            "profile": profile,
        }

        report = None
        async for chunk in graph.astream(initial_state):
            if "depth_agent" in chunk:
                yield format_event("progress", {"message": "Depth scoring complete. Analyzing gaps..."})
            elif "gap_agent" in chunk:
                yield format_event("progress", {"message": "Gap analysis complete. Rewriting bullets..."})
            elif "rewriter_agent" in chunk:
                yield format_event("progress", {"message": "Bullets rewritten. Generating positioning..."})
            elif "narrative_agent" in chunk:
                yield format_event("progress", {"message": "Positioning complete. Assembling report..."})
                narrative_output = chunk["narrative_agent"]
                if narrative_output.get("report"):
                    report = narrative_output["report"]
                elif narrative_output.get("error"):
                    error = narrative_output["error"]
                    yield format_event("error", {"message": f"{error.agent} failed: {error.message}"})
                    return

        if report:
            yield format_event("report", {
                "report_id": report.report_id,
                "target_role": report.target_role,
                "depth_score": report.depth_score.model_dump(),
                "gaps": [g.model_dump() for g in report.gaps],
                "rewrites": report.rewrites or [],
                "summary_rewrite": report.summary_rewrite,
                "summary_placeholders": report.summary_placeholders or [],
                "positioning": report.positioning.model_dump(),
                "signal_note": report.signal_note,
            })
        else:
            yield format_event("error", {"message": "Report generation failed"})
            return

        yield format_event("done", {"message": "Analysis complete"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )