import json
import logging
from openai import AsyncOpenAI
from openai import RateLimitError

from packages.pipeline.agents.state import AssayState, PipelineError

logger = logging.getLogger(__name__)


REWRITER_SYSTEM_PROMPT = """
You are a professional CV rewriter. You rewrite weak content across the entire CV —
profile summary, work experience bullets — producing ready-to-use replacements.

ABSOLUTE RULES — NEVER BREAK THESE:
- Never invent job titles, company names, dates, or qualifications
- Never add a skill, tool, or technology not mentioned in the original
- Never fabricate a metric — use [e.g. 30%] format with a realistic example
- If a bullet has zero detail to work with, flag it: "Add detail: what was the outcome?"
- You are a REWRITER not an INVENTOR

PLACEHOLDER FORMAT:
Use [e.g. realistic_example] — never bare [%] or [number].
The example tells the user what type of number to fill in.
Examples:
  [e.g. 30%] not [%]
  [e.g. 45 enterprise accounts] not [number of accounts]
  [e.g. $2M ARR] not [revenue]
  [e.g. 6 weeks] not [timeframe]
If the original already has a specific number, keep it exactly — do not replace it.

PROFILE SUMMARY RULES:
- Rewrite only if a summary exists in the original
- If no summary exists, set summary_rewrite to null
- Keep the same length as the original — do not shorten or expand significantly
- Improve clarity, remove filler phrases, ground claims in specific signals
- Keep the candidate's voice — do not replace their personality with generic language
- No "passionate about", "results-driven", "dynamic", or filler phrases
- Structure: [Who you are professionally] + [Strongest signal] + [What you target]
- Ground every claim in a signal actually present in their work experience

BULLET EVALUATION:
A bullet is STRONG if it has at least two of:
- Specific measurable outcome (numbers, %, $, time saved)
- Decision rationale (why this approach over alternatives)
- Clear ownership (who was affected, at what scale)
- Visible artifact or named output

A bullet is WEAK if it:
- Describes a duty without an outcome ("managed X")
- Uses vague language ("supported", "assisted", "helped with")
- Has activity metrics only ("attended 10 meetings", "handled 50+ accounts")
- Lacks specificity about scale, scope, or impact

BULLET REWRITE STRUCTURE:
[Strong action verb] + [what specifically] + [why this approach] + [outcome with [e.g.] placeholder]
- Maximum 2 sentences per bullet
- CV style — no "I", past tense, no full sentences
- Carry forward any existing metrics exactly

CAREER PATTERN VOCABULARY:
- builder: shipped, deployed, architected, built, implemented, reduced latency
- operator: streamlined, redesigned, reduced, standardised, automated, cut costs
- seller: closed, grew, retained, expanded, negotiated, exceeded quota
- strategist: defined, aligned, drove, prioritised, launched, delivered
- communicator: reached, engaged, converted, grew, positioned, launched

Return valid JSON only. No markdown. No explanation outside the JSON.
"""


REWRITER_USER_PROMPT = """
Rewrite this candidate's CV — profile summary and all work experience bullets.

Candidate name: {name}
Target role: {target_role}
Career type: {career_type}
Evidence pattern: {evidence_pattern}
Seniority: {seniority_context}

Original profile summary (null if none exists):
{profile_summary}

Job description context:
{jd_context}

Work experience signals to rewrite:
{signals}

Return this exact JSON structure:
{{
  "summary_rewrite": "rewritten profile summary (null if no original summary exists)",
  "summary_placeholders": ["what to fill in for each [e.g.] in the summary"],
  "rewrites": [
    {{
      "signal_name": "exact signal name",
      "company": "company name",
      "role": "role title",
      "bullets": [
        {{
          "index": 1,
          "original": "original bullet text verbatim",
          "status": "rewritten | kept | needs_detail",
          "rewritten": "ready-to-paste CV bullet with [e.g. metric] placeholders",
          "placeholders": ["description of each [e.g.] placeholder in order"],
          "reason": "one phrase: what dimension was added or why it was kept"
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

    def _extract_profile_summary(self, profile) -> str:
        """
        Extract profile summary from raw_text.
        Looks for common summary section headers.
        """
        if not profile.raw_text:
            return "null"

        text = profile.raw_text
        lines = text.split('\n')

        summary_headers = [
            'profile', 'summary', 'professional summary', 'about me',
            'about', 'overview', 'professional profile', 'career summary',
            'personal statement', 'objective', 'career objective',
        ]

        for i, line in enumerate(lines):
            if line.strip().lower() in summary_headers:
                # Collect next non-empty lines until next section
                summary_lines = []
                for j in range(i+1, min(i+8, len(lines))):
                    l = lines[j].strip()
                    if not l:
                        continue
                    # Stop if we hit another section header (short uppercase line)
                    if len(l) < 40 and l.upper() == l and not l.endswith('.'):
                        break
                    summary_lines.append(l)
                    if len(' '.join(summary_lines)) > 600:
                        break
                if summary_lines:
                    return ' '.join(summary_lines)

        return "null"

    def _split_bullets(self, raw_description: str) -> list[str]:
        """
        Split bullet text into individual bullets.
        Handles both numbered list format and concatenated sentence format.
        """
        import re
        raw = raw_description.strip()

        # Numbered list format: "1. bullet\n2. bullet"
        if re.search(r'^\d+\.', raw, re.MULTILINE):
            bullets = []
            for line in raw.split('\n'):
                b = re.sub(r'^\d+\.\s*', '', line.strip())
                if b and len(b) > 5:
                    bullets.append(b)
            return bullets

        # Concatenated format — split on capital letter after sentence end
        bullets = re.split(r'(?<=[.!?])\s+(?=[A-Z])', raw)
        return [b.strip() for b in bullets if b.strip() and len(b.strip()) > 5]

    def _build_signals_input(self, profile, depth_score) -> str:
        lines = []
        for signal in profile.work_signals:
            if signal.signal_type.value != "process":
                continue

            score_info = next(
                (ps for ps in depth_score.project_scores if ps.project_name == signal.name),
                None
            )
            score_summary = ""
            if score_info:
                score_summary = (
                    f"  Scores: problem={score_info.problem_framing.score}/3 | "
                    f"approach={score_info.approach_decisions.score}/3 | "
                    f"adapt={score_info.adaptability_learning.score}/3 | "
                    f"impact={score_info.impact_outcomes.score}/3"
                )

            bullets = self._split_bullets(signal.raw_description)

            lines.append(f"Signal: {signal.name}")
            if score_summary:
                lines.append(score_summary)
            lines.append(f"  Total bullets: {len(bullets)} — rewrite ALL of them")
            lines.append("  Bullets:")
            for i, b in enumerate(bullets, 1):
                lines.append(f"  {i}. {b}")
            lines.append("")

        return "\n".join(lines) if lines else ""

    async def run(self, state: AssayState) -> dict:
        if state.get("error"):
            return {}

        profile = state["profile"]
        depth_score = state["depth_score"]

        signals_input = self._build_signals_input(profile, depth_score)
        profile_summary = self._extract_profile_summary(profile)

        # Skip if nothing to rewrite
        if not signals_input.strip() and profile_summary == "null":
            logger.info("Nothing to rewrite — skipping rewriter agent")
            return {"rewrites": [], "summary_rewrite": None, "summary_placeholders": []}

        job_description = state.get("job_description")
        if job_description:
            jd_context = f"""Target job description:
---
{job_description[:2000]}
---
Calibrate every rewrite to what this specific role requires.
Make the summary specifically address this role.
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
                            name=profile.name or "Candidate",
                            target_role=state["target_role"],
                            career_type=profile.career_type.value,
                            evidence_pattern=profile.evidence_pattern.value,
                            seniority_context=seniority_context,
                            profile_summary=profile_summary,
                            jd_context=jd_context,
                            signals=signals_input,
                        ),
                    },
                ],
            )

            data = json.loads(response.choices[0].message.content)
            rewrites = data.get("rewrites", [])
            summary_rewrite = data.get("summary_rewrite")
            summary_placeholders = data.get("summary_placeholders", [])

            logger.info(
                f"Rewriter: {len(rewrites)} signals, "
                f"summary={'yes' if summary_rewrite else 'no'} "
                f"for {state['target_role']}"
            )
            return {
                "rewrites": rewrites,
                "summary_rewrite": summary_rewrite,
                "summary_placeholders": summary_placeholders,
            }

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
            return {"rewrites": [], "summary_rewrite": None, "summary_placeholders": []}

        except Exception as e:
            logger.error(f"Rewriter Agent unexpected error: {e}", exc_info=True)
            return {"rewrites": [], "summary_rewrite": None, "summary_placeholders": []}