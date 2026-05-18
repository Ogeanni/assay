from pydantic import BaseModel
from typing import Optional, Any
from langgraph.graph import MessagesState

from packages.core.schemas.depth import DepthScore
from packages.core.schemas.report import GapItem, PositioningBrief, AssayReport
from packages.core.schemas.resume import ResumeProfile

class PipelineError(BaseModel):
    agent: str
    type: str
    message: str
    retryable: bool

class AssayState(MessagesState):
    # Inputs
    target_role: str
    profile: ResumeProfile
    job_description: Optional[str] = None

    # Agent outputs
    depth_score: Optional[DepthScore] = None
    gaps: Optional[list[GapItem]] = None
    rewrites: Optional[list[dict]] = None   # rewriter agent output
    summary_rewrite: Optional[str] = None
    summary_placeholders: Optional[list[str]] = None
    positioning: Optional[PositioningBrief] = None
    report: Optional[AssayReport] = None

    # Error
    error: Optional[PipelineError] = None