import json
import logging
from openai import AsyncOpenAI
from openai import RateLimitError

from packages.pipeline.agents.state import AssayState, PipelineError

logger = logging.getLogger(__name__)


REWRITER_SYSTEM_PROMPT = """
You are a professional CV rewriter. Your job is to rewrite every weak bullet point
in a candidate's work experience — not just identify what's wrong, but produce
ready-to-paste replacements.

RULES:

1. EVALUATE EACH BULLET INDIVIDUALLY
   For each numbered bullet, decide: strong or weak.

   A bullet is STRONG if it has at least two of:
   - Specific measurable outcome (numbers, %, $, time)
   - Decision rationale (why this approach over alternatives)
   - Clear ownership (who was affected, at what scale)
   - Visible artifact or named output

   A bullet is WEAK if it:
   - Describes a duty without an outcome ("managed X")
   - Uses vague language ("supported", "assisted", "helped with")
   - Has activity metrics only ("attended 10 meetings")
   - Lacks any specificity about scale, scope, or impact

2. REWRITE EVERY WEAK BULLET
   Do not skip weak bullets. Rewrite all of them.

   Rewrite structure:
   [Strong action verb] + [what specifically] + [why this approach] + [outcome]

   - Add [placeholder] for any metric the candidate must fill in
   - Carry forward metrics that already exist — do not replace known facts
   - Add WHO was affected (scale/scope)
   - Add WHY this approach over alternatives (even if brief)
   - Add WHAT changed as a result (the downstream outcome)
   - Maximum 2 sentences per bullet
   - Write in CV style — no "I", no full sentences, past tense

3. KEEP STRONG BULLETS
   If a bullet is already strong, mark it as kept and return it unchanged.
   Do not rewrite for the sake of rewriting.

4. PLACEHOLDERS
   Use square brackets for any unknown specifics: [number of accounts], [% improvement]
   List each placeholder separately so the user knows what to fill in.
   If the original has a specific number, keep it exactly.

5. CAREER PATTERN AWARENESS
   Match vocabulary to the evidence pattern:
   - builder: ship, deploy, architect, build, implement
   - operator: streamline, redesign, reduce, standardise, automate
   - seller: close, grow, retain, expand, negotiate
   - strategist: define, align, drive, prioritise, launch
   - communicator: reach, engage, convert, grow, position

Return valid JSON only. No markdown. No explanation outside the JSON.
"""


REWRITER_USER_PROMPT = """
Rewrite all weak CV bullets for this candidate.

Target role: {target_role}
Career type: {career_type}
Evidence pattern: {evidence_pattern}
Seniority: {seniority_context}

Job description context:
{jd_context}

Work experience signals to rewrite:
{signals}

For each signal, return a rewritten version with every bullet evaluated.

Return this exact JSON structure:
{{
  "rewrites": [
    {{
      "signal_name": "exact signal name",
      "company": "company name extracted from signal name",
      "role": "role extracted from signal name",
      "bullets": [
        {{
          "index": 1,
          "original": "original bullet text",
          "status": "rewritten | kept",
          "rewritten": "ready-to-paste CV bullet (same as original if kept)",
          "placeholders": ["what to fill in for each [placeholder] in order"],
          "reason": "one phrase: what was added or why it was kept"
        }}
      ]
    }}
  ]
}}
"""


class RewriterAgent:
    def __init__(self, client: AsyncOpenAI, model: str = "gpt-4o-mini"):
        self.client = client
        self.model = model

    def _build_signals_input(self, profile, depth_score) -> str:
        """
        Build structured input for the rewriter.
        Only includes work experience signals (signal_type == process)
        with numbered bullets preserved from the parser.
        """
        lines = []
        for signal in profile.work_signals:
            # Only rewrite work experience signals — projects are handled differently
            if signal.signal_type.value != "process":
                continue

            # Get the depth score for this signal if available
            score_info = next(
                (ps for ps in depth_score.project_scores if ps.project_name == signal.name),
                None
            )
            score_summary = ""
            if score_info:
                score_summary = (
                    f"  Depth score: {score_info.depth_score}/100 | "
                    f"problem={score_info.problem_framing.score}/3 | "
                    f"approach={score_info.approach_decisions.score}/3 | "
                    f"adapt={score_info.adaptability_learning.score}/3 | "
                    f"impact={score_info.impact_outcomes.score}/3"
                )

            lines.append(f"Signal: {signal.name}")
            if score_summary:
                lines.append(score_summary)
            lines.append(f"  Bullets:")
            lines.append(signal.raw_description)
            lines.append("")

        return "\n".join(lines) if lines else ""

    async def run(self, state: AssayState) -> dict:
        if state.get("error"):
            return {}

        profile = state["profile"]
        depth_score = state["depth_score"]

        signals_input = self._build_signals_input(profile, depth_score)

        # If no work experience signals, skip rewriter
        if not signals_input.strip():
            logger.info("No work experience signals to rewrite — skipping rewriter agent")
            return {"rewrites": []}

        job_description = state.get("job_description")
        if job_description:
            jd_context = f"""
Target job description:
---
{job_description[:2000]}
---
Calibrate every rewrite to what this specific role requires.
"""
        else:
            jd_context = "No job description. Rewrite for the target role generally."

        ss = profile.seniority_signals
        seniority_context = (
            f"{ss.inferred_level} ({ss.confidence} confidence), "
            f"ownership: {ss.ownership_level}"
        ) if ss else "unknown seniority"

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                temperature=0.3,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": REWRITER_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": REWRITER_USER_PROMPT.format(
                            target_role=state["target_role"],
                            career_type=profile.career_type.value,
                            evidence_pattern=profile.evidence_pattern.value,
                            seniority_context=seniority_context,
                            jd_context=jd_context,
                            signals=signals_input,
                        ),
                    },
                ],
            )

            data = json.loads(response.choices[0].message.content)
            rewrites = data.get("rewrites", [])

            logger.info(
                f"Rewriter: {len(rewrites)} signals rewritten for {state['target_role']}"
            )
            return {"rewrites": rewrites}

        except RateLimitError:
            logger.error("Rewriter Agent hit OpenAI rate limit")
            return {
                "error": PipelineError(
                    agent="rewriter_agent",
                    type="RateLimitError",
                    message="OpenAI rate limit exceeded — try again in a few seconds",
                    retryable=True,
                )
            }

        except json.JSONDecodeError as e:
            logger.error(f"Rewriter Agent received malformed JSON: {e}")
            return {"rewrites": []}  # non-fatal — report still usable without rewrites

        except Exception as e:
            logger.error(f"Rewriter Agent unexpected error: {e}", exc_info=True)
            return {"rewrites": []}  # non-fatal