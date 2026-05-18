import json
import logging
from openai import AsyncOpenAI
from openai import RateLimitError

from packages.core.schemas.report import GapItem, GapSeverity
from packages.pipeline.agents.state import AssayState, PipelineError

logger = logging.getLogger(__name__)


GAP_SYSTEM_PROMPT = """
You are a career intelligence analyst and resume rewriter.

Your job has two parts:
1. Identify gaps between this candidate's profile and their target role
2. For each gap, write a rewritten bullet the candidate can paste directly into their CV

HARD CONSTRAINTS:

1. Career archetype is a hard constraint — never drift from it.
   Use career-appropriate vocabulary:
   - operator: "process", "workflow", "operation", "system", "protocol"
   - seller: "deal", "account", "pipeline", "relationship", "revenue"
   - strategist: "initiative", "decision", "framework", "roadmap", "alignment"
   - communicator: "campaign", "program", "audience", "message", "reach"
   - builder: "project", "system", "deployment", "architecture", "codebase"

2. Only reference work signals by their EXACT name as listed.
   NEVER elevate a responsibility into a work signal.
   NEVER invent or rename work signals.

3. Severity calibration:
   critical → required by the role AND completely absent from the profile
   moderate → present but lacks depth, specificity, or measurable outcome
   minor → refinement that would strengthen an already solid signal

4. THE REWRITTEN BULLET RULES:
   - For WORK EXPERIENCE signals: the raw_description is a numbered list of individual CV bullets.
     Identify the WEAKEST bullet for the gap dimension and rewrite THAT specific bullet.
     Quote the original bullet number in the recommendation so the user knows which one to replace.
   - For PROJECT signals: rewrite the description to add the missing dimension.
   - Write in CV style — action verb, what, why/decision, outcome
   - Structure: [Action verb] + [what] + [why this approach over alternatives] + [outcome with metric]
   - Always include at least one [placeholder] for any metric the candidate must fill in
   - Placeholders use square brackets: [number of accounts], [% improvement], [revenue figure]
   - The rewrite must be MEANINGFULLY DIFFERENT — not just the original with "successfully" added
   - Add: WHO was affected, WHY this approach, WHAT changed downstream
   - Never invent specific facts — use placeholders for unknown details
   - Maximum 2 sentences per rewritten bullet
   - Carry forward any metrics already present in the original — don't replace known facts with placeholders

5. PLACEHOLDER RULES:
   - List each placeholder as a short description of what to fill in
   - Example: ["number of enterprise accounts", "percentage time reduction", "churn improvement metric"]
   - Only list placeholders that appear in the rewritten_bullet
   - If the original already has the metric, carry it forward exactly

6. For WORK EXPERIENCE signals with numbered bullets:
   The recommendation MUST say: "Replace bullet [N] in your [Company] role with the rewritten version below."
   This tells the user exactly which line to update in their CV.

7. Missing data rule:
   Absence of evidence is not evidence of absence.
   Only flag a gap when the role clearly requires it AND the profile lacks it entirely.

8. When a JD is provided:
   Every gap MUST reference specific JD language.
   Every rewritten bullet MUST be calibrated to what the JD is asking for.

Maximum 5 gaps. Prioritise by severity.
Return valid JSON only. No markdown. No explanation outside the JSON.
"""


GAP_USER_PROMPT = """
Identify gaps and write rewritten bullets for this candidate.

Target role: {target_role}
Career type: {career_type}
Evidence pattern: {evidence_pattern}
Profile type: {profile_type}
Overall depth score: {depth_score} ({label})
Strongest work signal: {strongest_project}
Weakest work signal: {weakest_project}

Per-signal scores:
{project_scores_summary}

Raw signal descriptions (use these to write rewrites):
{signal_descriptions}

Transferable skills:
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
    "recommendation": "one concrete action tied to a specific work signal — 2 sentences max",
    "rewritten_bullet": "ready-to-paste CV bullet with [placeholder] for any metric the candidate must fill in",
    "placeholders": ["description of what to fill in for each placeholder in order"]
  }}
]
"""


class GapAgent:
    def __init__(self, client: AsyncOpenAI, model: str = "gpt-4o-mini"):
        self.client = client
        self.model = model

    def _build_signal_descriptions(self, profile, depth_score) -> str:
        """
        Pass raw signal descriptions so the LLM can write informed rewrites
        grounded in actual resume content.
        """
        lines = []
        for ps in depth_score.project_scores:
            # Find the matching signal
            signal = next(
                (s for s in profile.work_signals if s.name == ps.project_name),
                None
            )
            if not signal:
                continue

            lines.append(f"Signal: {ps.project_name}")
            lines.append(f"  Type: {signal.signal_type.value}")
            lines.append(f"  Raw description: {signal.raw_description[:400]}")
            if signal.business_metrics:
                lines.append(f"  Metrics present: {signal.business_metrics}")
            if signal.tools_with_rationale:
                lines.append(f"  Decisions made: {signal.tools_with_rationale}")
            lines.append(f"  Scores: problem={ps.problem_framing.score} "
                        f"approach={ps.approach_decisions.score} "
                        f"adapt={ps.adaptability_learning.score} "
                        f"impact={ps.impact_outcomes.score}")
            lines.append("")

        return "\n".join(lines) or "No signal descriptions available"

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

        signal_descriptions = self._build_signal_descriptions(profile, depth_score)

        transferable_skills = "\n".join([
            f"- {ts.skill}: from {ts.from_context} → {ts.to_context} ({ts.skill_type})"
            for ts in profile.transferable_skills
        ]) or "No transferable skills identified"

        job_description = state.get("job_description")
        if job_description:
            jd_context = f"""
JOB DESCRIPTION (use this as your primary evaluation source):
---
{job_description}
---

MANDATORY: For each gap, quote or reference the specific JD requirement.
For each rewritten bullet, calibrate the language and focus to what this JD is asking for.
"""
        else:
            jd_context = "No job description provided. Evaluate gaps and write rewrites for the target role generally."

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
                            signal_descriptions=signal_descriptions,
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
                    rewritten_bullet=item.get("rewritten_bullet"),
                    placeholders=item.get("placeholders", []),
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