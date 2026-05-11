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
    dimension: str          # which rubric dimension this gap is in
    description: str        # what specifically is missing
    severity: GapSeverity
    recommendation: str     # concrete action — not generic advice


class PositioningBrief(BaseModel):
    headline: str                                        # one sentence: strongest honest positioning
    lead_with: list[str] = Field(default_factory=list)  # projects or skills to front-load
    de_emphasize: list[str] = Field(default_factory=list) # items that add noise, not signal
    narrative: str                                       # 2-3 paragraph positioning strategy


class AssayReport(BaseModel):
    report_id: str
    target_role: str
    created_at: datetime

    # Core intelligence outputs
    profile: "ResumeProfile"
    depth_score: DepthScore
    gaps: list[GapItem] = Field(default_factory=list)
    positioning: PositioningBrief

    # Metadata
    model_version: str = "gpt-4o-mini"

    # Shown to user when score is based on limited signal
    signal_note: Optional[str] = None


class ReportResponse(BaseModel):
    report_id: str
    target_role: str
    created_at: datetime
    depth_score: DepthScore
    gaps: list[GapItem]
    positioning: PositioningBrief
    signal_note: Optional[str] = None


# Resolve forward references
from packages.core.schemas.resume import ResumeProfile
AssayReport.model_rebuild()