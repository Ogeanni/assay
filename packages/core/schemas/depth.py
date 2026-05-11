from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

class DepthLabel(str, Enum):
    expert = "Expert"        # 80-100 — deep, specific, evidenced, measurable
    proficient = "Proficient" # 55-79 — real work, some depth, gaps in specificity
    developing = "Developing" # 30-54 — foundational, execution-level, lacks outcomes
    unclear = "Unclear"       # 0-29  — insufficient signal to assess depth


class ConfidenceLevel(str, Enum):
    high = "High"      # rich descriptions, parser extracted strong signal
    medium = "Medium"  # some signal, some gaps in descriptions
    low = "Low"        # sparse descriptions, understatement possible


class DimensionScore(BaseModel):
    score: int = Field(ge=1, le=3)
    note: str

class ProjectDepthScore(BaseModel):
    project_name: str

    problem_framing: DimensionScore
    approach_decisions: DimensionScore     # was system_thinking
    adaptability_learning: DimensionScore  # was failure_iteration
    impact_outcomes: DimensionScore        # was business_metrics

    raw_total: int = Field(ge=4, le=12)
    depth_score: float = Field(ge=0.0, le=100.0)
    label: DepthLabel
    score_rationale: str


class DepthScore(BaseModel):
    # Phase 1 — resume signal only
    declared_score: float = Field(ge=0.0, le=100.0)
    confidence: ConfidenceLevel

    # Composite
    depth_score: float = Field(ge=0.0, le=100.0)
    label: DepthLabel

    # Per project breakdown
    project_scores: list[ProjectDepthScore] = Field(default_factory=list)

    # Summary
    strongest_project: Optional[str] = None
    weakest_project: Optional[str] = None
    missing_signals: list[str] = Field(default_factory=list)

    # Phase 2 placeholders — not scored yet
    demonstrated_score: Optional[float] = None  # GitHub signal
    contextual_score: Optional[float] = None    # Trajectory signal