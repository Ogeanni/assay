import fitz
import json
import logging
import re
from openai import AsyncOpenAI
from packages.core.schemas.resume import (
    ResumeProfile,
    WorkSignal,
    WorkExperience,
    TransferableSkill,
    SeniorityLevel,
    SenioritySignals,
    OwnershipLevel,
    ProfileType,
    CareerType,
    EvidencePattern,
    get_evidence_pattern,
)

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = """
You are a structured data extraction system for resumes and CVs across all career types.
Your job is extraction only — not evaluation.

CAREER TYPE DETECTION:
First determine the career_type from the target role and work history.
Then determine the evidence_pattern:
- builder: engineering, devops, cloud, AI/ML, data engineering, cybersecurity, QA, design, UX
- operator: operations, customer support/success, HR, finance, accounting, supply chain, admin
- seller: sales, business development, account management
- strategist: product, program management, data science, analytics, strategy, consulting, legal
- communicator: marketing, PR, content, social media, events, hospitality

SENIORITY INFERENCE RULES:
Never infer seniority from title alone.
Use years in relevant domain as baseline:
- 0-2 years → junior
- 2-5 years → mid
- 5-10 years → senior
- 10+ years → staff/executive

Adjust UP: managed a team, cross-functional ownership, built from scratch at org level, defined strategy
Adjust DOWN: "supported", "assisted", "contributed to", no measurable outcomes anywhere

PROJECTS SECTION DETECTION:
Always extract work signals from sections with these types of headings:
- "CS Projects", "CSM Projects", "Marketing Projects", "[Career] Projects"
- "Independent Builds", "Side Projects", "Personal Projects", "Portfolio"
- "Case Studies", "Featured Work", "Selected Work", "Tools Built"
- Any section listing named tools, products, campaigns, or initiatives

Named tools or products with descriptions are ALWAYS work signals.
Do NOT skip a section because its heading is unfamiliar.

WORK SIGNAL DEFINITION:
A work signal is a DISCRETE unit of work — it had a defined scope and produced an outcome.
Key test: "Did this specific thing happen, or is this just describing the job?"

A work signal IS:
- A named tool, product, or system built
- A discrete initiative with a scope and outcome
- A specific deal, campaign, or process redesign with measurable result

A work signal is NOT:
- An ongoing duty: "managed customer relationships"
- A participation: "supported the team with X"
- A practice: "developed customer feedback loops that informed product cycles"

NAMING RULES:
The name field must be:
1. The EXACT name from the resume if one exists
2. For unnamed initiatives from experience bullets:
   "[Company] — [brief descriptor using words from the resume]"
NEVER invent a name that does not appear in the resume.

EVIDENCE vs RESPONSIBILITY:
Evidence requires at least one of:
- measurable outcome with specific numbers
- named tool or artifact that was shipped
- explicit ownership with scope
- decision made with rationale

RULES:
- For ALL list fields return [] instead of null. Never return null for a list field.
- Extract only what is explicitly stated. Never infer or invent.
- Return valid JSON only. No markdown. No explanation. No preamble.
"""

EXTRACTION_USER_PROMPT = """
Extract structured signal from this resume and return a JSON object.

Target role: {target_role}

Schema:
{{
  "name": string | null,
  "target_role": string | null,
  "career_type": "engineering|devops|cloud_engineering|ai_ml_engineering|data_engineering|cybersecurity|it_support|qa_testing|design|ux_research|operations|business_operations|customer_support|customer_success|hr_people_ops|recruiting|learning_development|finance|accounting|supply_chain|procurement|manufacturing|retail_operations|healthcare_admin|administration|executive_assistant|sales|sales_engineering|business_development|account_management|product_management|project_management|program_management|technical_program_management|data_science|data_analytics|business_intelligence|research|strategy|consulting|executive_leadership|fpa|legal|compliance|nonprofit|government|education|marketing|growth_marketing|brand_marketing|content_marketing|seo_sem|social_media|communications_pr|media_creative|event_management|hospitality|unknown",
  "evidence_pattern": "builder|operator|seller|strategist|communicator",
  "seniority_level": "junior|mid|senior|staff|unknown",
  "seniority_signals": {{
    "title_seniority": string | null,
    "years_total": integer | null,
    "years_in_domain": integer | null,
    "scope_indicators": [string],
    "ownership_level": "executing|contributing|leading|defining",
    "complexity_signals": [string],
    "inferred_level": "junior|mid|senior|staff|unknown",
    "confidence": "high|medium|low",
    "reasoning": "one sentence explaining the inference"
  }},
  "profile_type": "direct|adjacent|career_change|no_experience",
  "technical_skills": [string],
  "domain_skills": [string],
  "total_experience_months": integer | null,
  "transferable_skills": [
    {{
      "skill": string,
      "from_context": string,
      "to_context": string,
      "skill_type": "technical|analytical|business"
    }}
  ],
  "work_experience": [
    {{
      "company": string,
      "role": string,
      "duration_months": integer | null,
      "domain": string | null,
      "is_relevant_to_target": boolean | null,
      "responsibilities": [string],
      "transferable_skills": [
        {{
          "skill": string,
          "from_context": string,
          "to_context": string,
          "skill_type": "technical|analytical|business"
        }}
      ]
    }}
  ],
  "work_signals": [
    {{
      "name": string,
      "raw_description": string,
      "signal_type": "project|process|deal|initiative|campaign|general",
      "problem_stated": string | null,
      "problem_owner": string | null,
      "problem_cost": string | null,
      "architectural_decisions": [string],
      "tools_with_rationale": [string],
      "tools_listed_only": [string],
      "failures_described": [string],
      "pivots_made": [string],
      "lessons_learned": [string],
      "model_metrics": [string],
      "business_metrics": [string],
      "metric_connection_explicit": boolean
    }}
  ]
}}

Resume text:
{resume_text}
"""


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text_blocks = []
    for page in doc:
        blocks = page.get_text("blocks")
        blocks.sort(key=lambda b: (b[1], b[0]))
        for block in blocks:
            text = block[4].strip()
            if text:
                text_blocks.append(text)
    return "\n".join(text_blocks)


PORTFOLIO_EXCLUSION_KEYWORDS = [
    'portfolio website', 'portfolio site', 'personal website', 'personal site',
    'portfolio page', 'my website', 'personal portfolio', 'website portfolio',
    'netlify', 'github.io', 'vercel.app',
]

def is_portfolio_website(signal: dict) -> bool:
    name = signal.get("name", "").lower()
    desc = signal.get("raw_description", "").lower()
    combined = name + " " + desc
    return any(kw in combined for kw in PORTFOLIO_EXCLUSION_KEYWORDS)


def should_prioritise_experience(profile_data: dict) -> bool:
    profile_type = profile_data.get("profile_type", "no_experience")
    total_months = profile_data.get("total_experience_months") or 0
    return profile_type in ("direct", "adjacent") and total_months >= 24


def experience_to_work_signals(profile_data: dict) -> list:
    """
    Convert work experience entries into scoreable work signals.
    Preserves individual bullets as a numbered list in raw_description
    so the gap agent can identify and rewrite each bullet individually.
    """
    signals = []
    work_experience = profile_data.get("work_experience", [])

    for exp in work_experience[:3]:
        company = exp.get("company", "Unknown")
        role = exp.get("role", "Unknown")
        responsibilities = exp.get("responsibilities", [])
        transferable = exp.get("transferable_skills", [])

        if not responsibilities:
            continue

        # KEY CHANGE: preserve individual bullets as numbered list
        # This allows the gap agent to identify and rewrite each bullet separately
        numbered_bullets = "\n".join([
            f"{i+1}. {resp.strip()}"
            for i, resp in enumerate(responsibilities)
            if resp.strip()
        ])

        # Extract business metrics
        business_metrics = []
        for resp in responsibilities:
            metrics = re.findall(
                r'\d+[%$][\w\s]*|[$]\d+[\w\s]*|\d+\s*(?:percent|accounts|clients|teams?|points?)',
                resp, re.IGNORECASE
            )
            business_metrics.extend(metrics)

        if len(responsibilities) < 2 and not business_metrics:
            continue

        signal = {
            "name": f"{company} — {role}",
            "raw_description": numbered_bullets,  # numbered list, not blob
            "signal_type": "process",
            "problem_stated": None,
            "problem_owner": None,
            "problem_cost": None,
            "architectural_decisions": [],
            "tools_with_rationale": [],
            "tools_listed_only": [ts.get("skill", "") for ts in transferable if ts.get("skill_type") == "technical"],
            "failures_described": [],
            "pivots_made": [],
            "lessons_learned": [],
            "model_metrics": [],
            "business_metrics": business_metrics,
            "metric_connection_explicit": len(business_metrics) > 0,
            "parser_confidence": 0.7,
            "understatement_detected": len(business_metrics) == 0,
        }
        signals.append(signal)

    return signals


class ResumeParser:
    def __init__(self, client: AsyncOpenAI, model: str = "gpt-4o-mini"):
        self.client = client
        self.model = model

    async def parse(self, pdf_bytes: bytes, target_role: str) -> ResumeProfile:
        raw_text = extract_text_from_pdf(pdf_bytes)
        logger.info(f"Extracted {len(raw_text)} characters from PDF")

        profile_data = await self._extract_structure(raw_text, target_role)

        career_type_str = profile_data.get("career_type", "unknown")
        try:
            career_type = CareerType(career_type_str)
        except ValueError:
            career_type = CareerType.unknown

        derived_pattern = get_evidence_pattern(career_type)
        profile_data["evidence_pattern"] = derived_pattern.value

        seniority_signals = profile_data.get("seniority_signals")
        if seniority_signals and seniority_signals.get("inferred_level"):
            profile_data["seniority_level"] = seniority_signals["inferred_level"]

        all_signals = profile_data.get("work_signals", [])
        filtered_signals = [s for s in all_signals if not is_portfolio_website(s)]
        if len(filtered_signals) < len(all_signals):
            removed = [s["name"] for s in all_signals if is_portfolio_website(s)]
            logger.info(f"Excluded portfolio websites from scoring: {removed}")
        profile_data["work_signals"] = filtered_signals

        if should_prioritise_experience(profile_data):
            experience_signals = experience_to_work_signals(profile_data)
            existing_signals = profile_data.get("work_signals", [])
            profile_data["work_signals"] = experience_signals + existing_signals
            logger.info(
                f"Experience-first mode: {len(experience_signals)} experience signals, "
                f"{len(existing_signals)} project signals"
            )

        if len(raw_text.strip()) < 100:
            raise ValueError(
                "PDF appears to be empty or scanned without text. "
                "Please upload a text-based PDF."
            )

        profile = ResumeProfile(**profile_data, raw_text=raw_text)
        logger.info(
            f"Parsed: {len(profile.work_signals)} signals, "
            f"career={profile.career_type}, "
            f"pattern={profile.evidence_pattern}, "
            f"seniority={profile.seniority_level}"
        )
        return profile

    async def _extract_structure(self, resume_text: str, target_role: str) -> dict:
        response = await self.client.chat.completions.create(
            model=self.model,
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": EXTRACTION_USER_PROMPT.format(
                        target_role=target_role,
                        resume_text=resume_text,
                    ),
                },
            ],
        )

        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty response from extraction model")

        return json.loads(content)