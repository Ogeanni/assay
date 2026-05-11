from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class SeniorityLevel(str, Enum):
    junior = "junior"
    mid = "mid"
    senior = "senior"
    staff = "staff"
    unknown = "unknown"


class ProfileType(str, Enum):
    direct = "direct"                   # work experience matches target role
    adjacent = "adjacent"               # related domain, different role — my case
    career_change = "career_change"     # no overlap between work and target
    no_experience = "no_experience"     # projects only, no work history


class OwnershipLevel(str, Enum):
    executing = "executing"      # following someone else's plan
    contributing = "contributing" # part of a team effort
    leading = "leading"          # directing others toward a goal
    defining = "defining"        # setting the strategy or direction


class SenioritySignals(BaseModel):
    """
    Structured seniority inference — not a label, a set of signals.
    The parser extracts these. Agents reason from them.
    Never infer seniority from title alone.
    """
    title_seniority: Optional[str] = None      # what the title says if anything
    years_total: Optional[int] = None           # total career years
    years_in_domain: Optional[int] = None       # years in target domain
    scope_indicators: list[str] = Field(default_factory=list)
    # e.g. "led team of 8", "org-wide initiative", "cross-functional"
    ownership_level: OwnershipLevel = OwnershipLevel.contributing
    complexity_signals: list[str] = Field(default_factory=list)
    # e.g. "ambiguous problem", "novel solution", "no prior framework"
    inferred_level: SeniorityLevel = SeniorityLevel.unknown
    confidence: str = "low"     # high | medium | low
    reasoning: str = ""         # why we inferred this level


class EvidencePattern(str, Enum):
    builder = "builder"           # created things that can be inspected
    operator = "operator"         # ran systems, improved processes
    seller = "seller"             # deals, pipelines, relationships
    strategist = "strategist"     # decisions, frameworks, org outcomes
    communicator = "communicator" # audiences, messages, influence


class CareerType(str, Enum):
    # Builder pattern
    engineering = "engineering"
    devops = "devops"
    cloud_engineering = "cloud_engineering"
    ai_ml_engineering = "ai_ml_engineering"
    data_engineering = "data_engineering"
    cybersecurity = "cybersecurity"
    it_support = "it_support"
    qa_testing = "qa_testing"
    design = "design"
    ux_research = "ux_research"

    # Operator pattern
    operations = "operations"
    business_operations = "business_operations"
    customer_support = "customer_support"
    customer_success = "customer_success"
    hr_people_ops = "hr_people_ops"
    recruiting = "recruiting"
    learning_development = "learning_development"
    finance = "finance"
    accounting = "accounting"
    supply_chain = "supply_chain"
    procurement = "procurement"
    it_support_ops = "it_support_ops"
    manufacturing = "manufacturing"
    retail_operations = "retail_operations"
    healthcare_admin = "healthcare_admin"
    real_estate = "real_estate"
    administration = "administration"
    executive_assistant = "executive_assistant"

    # Seller pattern
    sales = "sales"
    sales_engineering = "sales_engineering"
    business_development = "business_development"
    account_management = "account_management"

    # Strategist pattern
    product_management = "product_management"
    project_management = "project_management"
    program_management = "program_management"
    technical_program_management = "technical_program_management"
    data_science = "data_science"
    data_analytics = "data_analytics"
    business_intelligence = "business_intelligence"
    research = "research"
    strategy = "strategy"
    consulting = "consulting"
    executive_leadership = "executive_leadership"
    fpa = "fpa"
    legal = "legal"
    compliance = "compliance"
    nonprofit = "nonprofit"
    government = "government"
    education = "education"

    # Communicator pattern
    marketing = "marketing"
    growth_marketing = "growth_marketing"
    brand_marketing = "brand_marketing"
    content_marketing = "content_marketing"
    seo_sem = "seo_sem"
    social_media = "social_media"
    communications_pr = "communications_pr"
    media_creative = "media_creative"
    event_management = "event_management"
    hospitality = "hospitality"

    unknown = "unknown"


class WorkSignalType(str, Enum):
    project = "project"           # builder: something created
    process_change = "process"    # operator: something improved
    deal = "deal"                 # seller: something closed
    initiative = "initiative"     # strategist: something decided
    campaign = "campaign"         # communicator: something launched
    general = "general"           # when type is unclear



CAREER_TO_PATTERN: dict[CareerType, EvidencePattern] = {
    # Builder
    CareerType.engineering: EvidencePattern.builder,
    CareerType.devops: EvidencePattern.builder,
    CareerType.cloud_engineering: EvidencePattern.builder,
    CareerType.ai_ml_engineering: EvidencePattern.builder,
    CareerType.data_engineering: EvidencePattern.builder,
    CareerType.cybersecurity: EvidencePattern.builder,
    CareerType.it_support: EvidencePattern.builder,
    CareerType.qa_testing: EvidencePattern.builder,
    CareerType.design: EvidencePattern.builder,
    CareerType.ux_research: EvidencePattern.builder,

    # Operator
    CareerType.operations: EvidencePattern.operator,
    CareerType.business_operations: EvidencePattern.operator,
    CareerType.customer_support: EvidencePattern.operator,
    CareerType.customer_success: EvidencePattern.operator,
    CareerType.hr_people_ops: EvidencePattern.operator,
    CareerType.recruiting: EvidencePattern.operator,
    CareerType.learning_development: EvidencePattern.operator,
    CareerType.finance: EvidencePattern.operator,
    CareerType.accounting: EvidencePattern.operator,
    CareerType.supply_chain: EvidencePattern.operator,
    CareerType.procurement: EvidencePattern.operator,
    CareerType.manufacturing: EvidencePattern.operator,
    CareerType.retail_operations: EvidencePattern.operator,
    CareerType.healthcare_admin: EvidencePattern.operator,
    CareerType.administration: EvidencePattern.operator,
    CareerType.executive_assistant: EvidencePattern.operator,

    # Seller
    CareerType.sales: EvidencePattern.seller,
    CareerType.sales_engineering: EvidencePattern.seller,
    CareerType.business_development: EvidencePattern.seller,
    CareerType.account_management: EvidencePattern.seller,

    # Strategist
    CareerType.product_management: EvidencePattern.strategist,
    CareerType.project_management: EvidencePattern.strategist,
    CareerType.program_management: EvidencePattern.strategist,
    CareerType.technical_program_management: EvidencePattern.strategist,
    CareerType.data_science: EvidencePattern.strategist,
    CareerType.data_analytics: EvidencePattern.strategist,
    CareerType.business_intelligence: EvidencePattern.strategist,
    CareerType.research: EvidencePattern.strategist,
    CareerType.strategy: EvidencePattern.strategist,
    CareerType.consulting: EvidencePattern.strategist,
    CareerType.executive_leadership: EvidencePattern.strategist,
    CareerType.fpa: EvidencePattern.strategist,
    CareerType.legal: EvidencePattern.strategist,
    CareerType.compliance: EvidencePattern.strategist,
    CareerType.nonprofit: EvidencePattern.strategist,
    CareerType.government: EvidencePattern.strategist,
    CareerType.education: EvidencePattern.strategist,

    # Communicator
    CareerType.marketing: EvidencePattern.communicator,
    CareerType.growth_marketing: EvidencePattern.communicator,
    CareerType.brand_marketing: EvidencePattern.communicator,
    CareerType.content_marketing: EvidencePattern.communicator,
    CareerType.seo_sem: EvidencePattern.communicator,
    CareerType.social_media: EvidencePattern.communicator,
    CareerType.communications_pr: EvidencePattern.communicator,
    CareerType.media_creative: EvidencePattern.communicator,
    CareerType.event_management: EvidencePattern.communicator,
    CareerType.hospitality: EvidencePattern.communicator,
}


def get_evidence_pattern(career_type: CareerType) -> EvidencePattern:
    return CAREER_TO_PATTERN.get(career_type, EvidencePattern.builder)


class TransferableSkill(BaseModel):
    skill: str
    from_context: str    # what role/domain they used it in
    to_context: str      # how it applies to the target role
    skill_type: str      # "technical" or "analytical" or "business"


class WorkExperience(BaseModel):
    company: str
    role: str
    duration_months: Optional[int] = None
    domain: Optional[str] = None
    is_relevant_to_target: Optional[bool] = None
    responsibilities: list[str] = Field(default_factory=list)
    transferable_skills: list[TransferableSkill] = Field(default_factory=list)


class WorkSignal(BaseModel):
    name: str
    raw_description: str
    signal_type: WorkSignalType = WorkSignalType.general

    # Dimension 1 — Problem Framing
    problem_stated: Optional[str] = None
    problem_owner: Optional[str] = None
    problem_cost: Optional[str] = None

    # Dimension 2 — System Thinking
    architectural_decisions: list[str] = Field(default_factory=list)
    tools_with_rationale: list[str] = Field(default_factory=list)
    tools_listed_only: list[str] = Field(default_factory=list)

    # Dimension 3 — Failure and Iteration
    failures_described: list[str] = Field(default_factory=list)
    pivots_made: list[str] = Field(default_factory=list)
    lessons_learned: list[str] = Field(default_factory=list)

    # Dimension 4 — Business Metrics
    model_metrics: list[str] = Field(default_factory=list)
    business_metrics: list[str] = Field(default_factory=list)
    metric_connection_explicit: bool = False

    # Parser metadata
    parser_confidence: float = Field(ge=0.0, le=1.0, default=1.0)
    understatement_detected: bool = False


class ResumeProfile(BaseModel):
    # Identity
    name: Optional[str] = None
    target_role: Optional[str] = None
    career_type: CareerType = CareerType.unknown
    evidence_pattern: EvidencePattern = EvidencePattern.builder
    seniority_level: SeniorityLevel = SeniorityLevel.unknown
    seniority_signals: Optional[SenioritySignals] = None
    profile_type: ProfileType = ProfileType.no_experience

    # Core signal — renamed from projects to work_signals
    work_signals: list[WorkSignal] = Field(default_factory=list)
    work_experience: list[WorkExperience] = Field(default_factory=list)

    # Skills
    technical_skills: list[str] = Field(default_factory=list)
    domain_skills: list[str] = Field(default_factory=list)
    transferable_skills: list[TransferableSkill] = Field(default_factory=list)

    # Context
    total_experience_months: Optional[int] = None
    raw_text: str = ""