from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime

from packages.core.schemas.depth import DepthScore


class GapSeverity(str, Enum):
    critical = "critical"
    moderate = "moderate"
    minor = "minor"


class GapItem(BaseModel):
    dimension: str
    description: str
    severity: GapSeverity
    recommendation: str
    # Rewriter fields — always populated
    rewritten_bullet: Optional[str] = None   # ready-to-paste improved bullet
    placeholders: list[str] = Field(default_factory=list)  # blanks user fills in


class PositioningBrief(BaseModel):
    headline: str
    lead_with: list[str] = Field(default_factory=list)
    de_emphasize: list[str] = Field(default_factory=list)
    narrative: str


class AssayReport(BaseModel):
    report_id: str
    target_role: str
    created_at: datetime

    profile: "ResumeProfile"
    depth_score: DepthScore
    gaps: list[GapItem] = Field(default_factory=list)
    rewrites: list[dict] = Field(default_factory=list)  # rewriter agent output
    positioning: PositioningBrief

    model_version: str = "gpt-4o-mini"
    signal_note: Optional[str] = None


class ReportResponse(BaseModel):
    report_id: str
    target_role: str
    created_at: datetime
    depth_score: DepthScore
    gaps: list[GapItem]
    rewrites: list[dict] = Field(default_factory=list)
    positioning: PositioningBrief
    signal_note: Optional[str] = None


from packages.core.schemas.resume import ResumeProfile
AssayReport.model_rebuild()