import json
import logging
import uuid
from datetime import datetime, timezone
from openai import AsyncOpenAI
from openai import RateLimitError

from packages.core.schemas.report import AssayReport, PositioningBrief
from packages.pipeline.agents.state import AssayState, PipelineError

logger = logging.getLogger(__name__)


NARRATIVE_SYSTEM_PROMPT = """
You are a senior career strategist writing positioning for professionals across all career types.

HARD CONSTRAINTS:

1. NEVER use the word "project" for non-builder evidence patterns.
   Use career-appropriate vocabulary:
   - operator: "process", "initiative", "system", "workflow"
   - seller: "deal", "account", "approach", "motion"
   - strategist: "initiative", "framework", "decision", "program"
   - communicator: "campaign", "program", "approach", "launch"

2. NEVER reference work items not in the work_signals list.
   lead_with must contain ONLY exact names from the work_signals provided.
   Do not promote responsibilities into positioning anchors.
   Do not invent initiatives, projects, or achievements not in the profile.
   lead_with should prioritise work signals that demonstrate IMPACT and OUTCOMES.

3. CRITICAL — DISTINGUISH PROJECTS FROM WORK EXPERIENCE:
   Every signal in the SIGNAL TYPE REFERENCE below is explicitly tagged as either
   WORK EXPERIENCE or INDEPENDENT PROJECT. Use that tag — never guess from the name.

   WORK EXPERIENCE signals (tagged as such):
   - The person was employed there. Reference as "at [Company]" or "in the [Role] role".
   - Never say "the [signal name] build" or "the [signal name] system".

   INDEPENDENT PROJECT signals (tagged as such):
   - The person built this. It is NOT an employer. It is NOT a place of work.
   - Reference as "the [name] build", "the [name] system", or "[name], an independent project".
   - NEVER say "experience at [name]", "work at [name]", or imply employment at a project name.
   - This rule applies regardless of how the project name sounds — even if it resembles a company name.

   When in doubt: check the SIGNAL TYPE REFERENCE. It is the ground truth.

4. ALL positioning claims must be traceable to explicit resume evidence.
   Do not infer seniority, ownership, scale, or technical depth beyond demonstrated signals.

5. Career-specific framing:
   builder → positioned on systems built, decisions made, outcomes enabled
   operator → positioned on process depth and operational impact
   seller → positioned on revenue outcomes and relationship depth
   strategist → positioned on decisions made and org outcomes
   communicator → positioned on audience reached and message impact

6. Seniority-appropriate framing:
   junior → position on learning velocity and execution quality
   mid → position on ownership and measurable impact
   senior → position on strategic influence and org outcomes
   unknown → position conservatively on demonstrated evidence only

7. Narrative structure — three paragraphs:
   Para 1: what this profile signals to a recruiter. Ground every claim in a specific signal.
             If referencing a project, say "the [name] build/system" not "experience at [name]".
   Para 2: what to lead with and exactly why — tied to the target role requirements.
   Para 3: the ONE most important thing to work on next, specific to their career type.

8. Never use: "passionate about", "leveraging", "synergistic", "dynamic",
   "results-driven", "thought leader", or any filler phrase.

Return valid JSON only. No markdown. No explanation outside the JSON.
"""


NARRATIVE_USER_PROMPT = """
Write a positioning strategy for this candidate.

Candidate name: {name}
Target role: {target_role}
Career type: {career_type}
Evidence pattern: {evidence_pattern}
Profile type: {profile_type}
Depth score: {depth_score} ({label})
Strongest work signal: {strongest_project}

SIGNAL TYPE REFERENCE — critical context to avoid misidentifying projects as employers:
{signal_type_reference}

Gaps identified:
{gaps_summary}

Work signals ranked by depth score:
{projects_summary}

Transferable skills:
{transferable_skills}

Seniority context:
{seniority_context}

Job description context:
{jd_context}

Return this exact JSON structure:
{{
  "headline": "one sentence — strongest honest positioning",
  "lead_with": ["work signal name to front-load"],
  "de_emphasize": ["item that adds noise not signal"],
  "narrative": "three paragraphs separated by newlines"
}}
"""


class NarrativeAgent:
    def __init__(self, client: AsyncOpenAI, model: str = "gpt-4o-mini"):
        self.model = model
        self.client = client

    def _build_signal_type_reference(self, profile) -> str:
        """
        Explicit map of signal names to their type.
        Prevents the LLM from calling projects 'experience at X'.
        """
        lines = []
        for signal in profile.work_signals:
            if " — " in signal.name and signal.signal_type.value == "process":
                parts = signal.name.split(" — ", 1)
                lines.append(
                    f"- '{signal.name}' → WORK EXPERIENCE at {parts[0]} "
                    f"(correct: 'at {parts[0]}' or 'in the {parts[1]} role')"
                )
            else:
                lines.append(
                    f"- '{signal.name}' → INDEPENDENT PROJECT "
                    f"(correct: 'the {signal.name} build/system/project', "
                    f"NEVER 'experience at {signal.name}' or 'work at {signal.name}')"
                )
        return "\n".join(lines) if lines else "No signals available"

    async def run(self, state: AssayState) -> dict:
        if state.get("error"):
            return {}

        profile = state["profile"]
        depth_score = state["depth_score"]
        gaps = state["gaps"] or []

        gaps_summary = "\n".join([
            f"- [{g.severity.value.upper()}] {g.dimension}: {g.description}"
            for g in gaps
        ]) or "No gaps identified"

        projects_summary = "\n".join([
            f"- {ps.project_name}: {ps.depth_score}/100 ({ps.label.value})"
            for ps in sorted(
                depth_score.project_scores,
                key=lambda s: s.depth_score,
                reverse=True,
            )
        ]) or "No work signals scored"

        transferable_skills = "\n".join([
            f"- {ts.skill}: {ts.from_context} → {ts.to_context}"
            for ts in profile.transferable_skills
        ]) or "No transferable skills identified"

        signal_type_reference = self._build_signal_type_reference(profile)

        job_description = state.get("job_description")
        if job_description:
            jd_context = f"""
JOB DESCRIPTION (this is the specific job being applied for):
---
{job_description}
---

MANDATORY INSTRUCTIONS when JD is provided:
1. The headline must reflect THIS specific job — reference a specific requirement from the JD.
2. lead_with must reference work signals that DIRECTLY match JD requirements.
3. The narrative must reference JD requirements explicitly in each paragraph.
4. Never give generic career advice. Every sentence must be traceable to the resume or the JD.
"""
        else:
            jd_context = "No job description provided. Position for the target role generally."

        ss = profile.seniority_signals
        if ss:
            seniority_context = (
                f"{ss.inferred_level} level ({ss.confidence} confidence). "
                f"Ownership: {ss.ownership_level}. {ss.reasoning}"
            )
        else:
            seniority_context = "Seniority unclear — position conservatively"

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                temperature=0.3,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": NARRATIVE_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": NARRATIVE_USER_PROMPT.format(
                            name=profile.name or "Candidate",
                            target_role=state["target_role"],
                            career_type=profile.career_type.value,
                            evidence_pattern=profile.evidence_pattern.value,
                            profile_type=profile.profile_type.value,
                            depth_score=depth_score.depth_score,
                            label=depth_score.label.value,
                            strongest_project=depth_score.strongest_project or "N/A",
                            signal_type_reference=signal_type_reference,
                            gaps_summary=gaps_summary,
                            projects_summary=projects_summary,
                            transferable_skills=transferable_skills,
                            seniority_context=seniority_context,
                            jd_context=jd_context,
                        ),
                    },
                ],
            )

            data = json.loads(response.choices[0].message.content)

            positioning = PositioningBrief(
                headline=data["headline"],
                lead_with=data["lead_with"],
                de_emphasize=data["de_emphasize"],
                narrative=data["narrative"],
            )

            signal_note = None
            if depth_score.missing_signals:
                signal_note = (
                    "Score based on resume signal only. "
                    "Link GitHub for a complete depth assessment."
                )

            report = AssayReport(
                report_id=str(uuid.uuid4()),
                target_role=state["target_role"],
                created_at=datetime.now(timezone.utc),
                profile=profile,
                depth_score=depth_score,
                gaps=gaps,
                positioning=positioning,
                signal_note=signal_note,
            )

            logger.info(f"Report assembled: {report.report_id}")
            return {"positioning": positioning, "report": report}

        except RateLimitError:
            logger.error("Narrative Agent hit OpenAI rate limit")
            return {
                "error": PipelineError(
                    agent="narrative_agent",
                    type="RateLimitError",
                    message="OpenAI rate limit exceeded — try again in a few seconds",
                    retryable=True,
                )
            }

        except json.JSONDecodeError as e:
            logger.error(f"Narrative Agent received malformed JSON: {e}")
            return {
                "error": PipelineError(
                    agent="narrative_agent",
                    type="JSONDecodeError",
                    message="LLM returned malformed JSON — could not parse narrative response",
                    retryable=True,
                )
            }

        except Exception as e:
            logger.error(f"Narrative Agent unexpected error: {e}", exc_info=True)
            return {
                "error": PipelineError(
                    agent="narrative_agent",
                    type=type(e).__name__,
                    message=str(e),
                    retryable=False,
                )
            }