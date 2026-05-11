import json
import logging
from openai import AsyncOpenAI
from openai import RateLimitError

from packages.core.schemas.report import GapItem, GapSeverity
from packages.pipeline.agents.state import AssayState, PipelineError

logger = logging.getLogger(__name__)


GAP_SYSTEM_PROMPT = """
You are a career intelligence analyst identifying gaps between a candidate's profile and target role.

HARD CONSTRAINTS:
1. Career archetype is a hard constraint — never drift from it.
   Use career-appropriate vocabulary throughout:
   - operator: "process", "workflow", "operation", "system", "protocol"
   - seller: "deal", "account", "pipeline", "relationship", "revenue"
   - strategist: "initiative", "decision", "framework", "roadmap", "alignment"
   - communicator: "campaign", "program", "audience", "message", "reach"
   - builder: "project", "system", "deployment", "architecture", "codebase"

2. Only reference work signals by their EXACT name as listed in the work signals.
   NEVER elevate a responsibility bullet into a work signal.
   NEVER invent or rename work signals.

3. Evidence vs responsibility:
   A responsibility is NOT a gap to fill — it is a duty that may or may not have depth.
   Only flag a gap when a signal type clearly required by the role is entirely absent.

4. Severity calibration:
   critical → required by the role AND completely absent from the profile
   moderate → present but lacks depth, specificity, or measurable outcome
   minor → refinement that would strengthen an already solid signal

5. Seniority awareness:
   Do not penalise junior candidates for lacking senior-level signals.
   Do not penalise operators for lacking builder signals.

6. Recommendation quality — concise and genuinely useful:
   Format: "In [signal name], [one sentence gap]. Instead of: [weak phrase from resume] Try: [rewrite that adds WHO + WHY + WHAT CHANGED]"
   The rewrite must be MEANINGFULLY DIFFERENT from the original — not just longer.
   Add: scope (how many people/accounts affected), decision rationale (why this over alternatives), downstream outcome (what it unlocked).
   Never invent facts. Use only what the resume implies or states.
   2 sentences maximum before the example.

7. Missing data:
   Absence of evidence is not evidence of absence.
   Only flag a gap when the role clearly requires it AND the profile lacks it entirely.

WHEN A JOB DESCRIPTION IS PROVIDED:
Every gap description MUST reference specific JD language.
Every recommendation MUST be tied to closing a specific JD requirement.
Generic gaps are not acceptable when a JD is present.

Maximum 5 gaps. Prioritise by severity.
Return valid JSON only. No markdown. No explanation outside the JSON.
"""


GAP_USER_PROMPT = """
Identify gaps between this candidate's profile and the target role.

Target role: {target_role}
Career type: {career_type}
Evidence pattern: {evidence_pattern}
Profile type: {profile_type}
Overall depth score: {depth_score} ({label})
Strongest work signal: {strongest_project}
Weakest work signal: {weakest_project}

Per-signal scores:
{project_scores_summary}

Transferable skills from work experience:
{transferable_skills}

Missing signals:
{missing_signals}

Seniority context:
{seniority_context}

Job description context:
{jd_context}

Return a JSON array:
[
  {{
    "dimension": "problem_framing | approach_decisions | adaptability_learning | impact_outcomes | general",
    "description": "specific gap referencing actual work signal names",
    "severity": "critical | moderate | minor",
    "recommendation": "one concrete action tied to a specific work signal"
  }}
]
"""


class GapAgent:
    def __init__(self, client: AsyncOpenAI, model: str = "gpt-4o-mini"):
        self.client = client
        self.model = model

    async def run(self, state: AssayState) -> dict:
        if state.get("error"):
            return {}

        profile = state["profile"]
        depth_score = state["depth_score"]

        project_scores_summary = "\n".join([
            f"- {ps.project_name}: "
            f"problem_framing={ps.problem_framing.score}, "
            f"approach_decisions={ps.approach_decisions.score}, "
            f"adaptability_learning={ps.adaptability_learning.score}, "
            f"impact_outcomes={ps.impact_outcomes.score} "
            f"(depth_score={ps.depth_score})"
            for ps in depth_score.project_scores
        ]) or "No work signals scored"

        transferable_skills = "\n".join([
            f"- {ts.skill}: from {ts.from_context} → {ts.to_context} ({ts.skill_type})"
            for ts in profile.transferable_skills
        ]) or "No transferable skills identified"

        # Job description context
        job_description = state.get("job_description")
        if job_description:
            jd_context = f"""
JOB DESCRIPTION (use this as your primary evaluation source):
---
{job_description}
---

MANDATORY: For each gap, quote or reference the specific JD requirement.
State whether the resume has this, partially has it, or lacks it entirely.
"""
        else:
            jd_context = "No job description provided. Evaluate gaps against the target role generally."

        # Build seniority context
        ss = profile.seniority_signals
        if ss:
            seniority_context = (
                f"{ss.inferred_level} level ({ss.confidence} confidence). "
                f"Ownership: {ss.ownership_level}. {ss.reasoning}"
            )
        else:
            seniority_context = "Seniority unclear"

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                temperature=0.3,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": GAP_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": GAP_USER_PROMPT.format(
                            target_role=state["target_role"],
                            career_type=profile.career_type.value,
                            evidence_pattern=profile.evidence_pattern.value,
                            profile_type=profile.profile_type.value,
                            depth_score=depth_score.depth_score,
                            label=depth_score.label.value,
                            strongest_project=depth_score.strongest_project or "N/A",
                            weakest_project=depth_score.weakest_project or "N/A",
                            project_scores_summary=project_scores_summary,
                            transferable_skills=transferable_skills,
                            missing_signals=depth_score.missing_signals or [],
                            seniority_context=seniority_context,
                            jd_context=jd_context,
                        ),
                    },
                ],
            )

            content = response.choices[0].message.content
            data = json.loads(content)

            items = data if isinstance(data, list) else data.get("gaps", [])

            gaps = [
                GapItem(
                    dimension=item["dimension"],
                    description=item["description"],
                    severity=GapSeverity(item["severity"]),
                    recommendation=item["recommendation"],
                )
                for item in items
            ]

            logger.info(f"Gap analysis: {len(gaps)} gaps for {state['target_role']}")
            return {"gaps": gaps}

        except RateLimitError:
            logger.error("Gap Agent hit OpenAI rate limit")
            return {
                "error": PipelineError(
                    agent="gap_agent",
                    type="RateLimitError",
                    message="OpenAI rate limit exceeded — try again in a few seconds",
                    retryable=True,
                )
            }

        except json.JSONDecodeError as e:
            logger.error(f"Gap Agent received malformed JSON: {e}")
            return {
                "error": PipelineError(
                    agent="gap_agent",
                    type="JSONDecodeError",
                    message="LLM returned malformed JSON",
                    retryable=True,
                )
            }

        except Exception as e:
            logger.error(f"Gap Agent unexpected error: {e}", exc_info=True)
            return {
                "error": PipelineError(
                    agent="gap_agent",
                    type=type(e).__name__,
                    message=str(e),
                    retryable=False,
                )
            }