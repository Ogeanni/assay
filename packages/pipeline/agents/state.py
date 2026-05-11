from pydantic import BaseModel
from typing import Optional
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
    # Inputs — set before graph starts
    target_role: str
    profile: ResumeProfile
    job_description: Optional[str] = None

    # Agent outputs — filled as pipeline runs
    depth_score: Optional[DepthScore] = None
    gaps: Optional[list[GapItem]] = None
    positioning: Optional[PositioningBrief] = None
    report: Optional[AssayReport] = None

    # Error — written by any agent on failure, halts pipeline
    error: Optional[PipelineError] = None
