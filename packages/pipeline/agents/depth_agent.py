import json
import logging
from openai import AsyncOpenAI
from openai import RateLimitError

from packages.core.constants import (
    EXPERT_THRESHOLD,
    PROFICIENT_THRESHOLD,
    DEVELOPING_THRESHOLD,
    normalize_score,
)
from packages.core.schemas.depth import (
    DepthLabel,
    DepthScore,
    ProjectDepthScore,
    DimensionScore,
    ConfidenceLevel,
)
from packages.core.schemas.resume import WorkSignal, EvidencePattern
from packages.pipeline.agents.state import AssayState, PipelineError

logger = logging.getLogger(__name__)


def label_from_score(score: float) -> DepthLabel:
    if score >= EXPERT_THRESHOLD:
        return DepthLabel.expert
    elif score >= PROFICIENT_THRESHOLD:
        return DepthLabel.proficient
    elif score >= DEVELOPING_THRESHOLD:
        return DepthLabel.developing
    else:
        return DepthLabel.unclear


# Evidence pattern specific guidance for the scoring prompt
PATTERN_GUIDANCE = {
    EvidencePattern.builder: """
Evidence pattern: BUILDER
Work signals are projects, systems, tools, or deployments.
- Problem Framing: why did this system/tool need to exist?
- Approach & Decisions: architectural decisions, technology choices with rationale
- Failure & Iteration: what broke during development, what had to be rebuilt
- Impact & Outcomes: what did the system enable in business terms
""",
    EvidencePattern.operator: """
Evidence pattern: OPERATOR
Work signals are process improvements, operational changes, systems managed.
- Problem Framing: what operational problem existed, what was the cost of it
- Approach & Decisions: how did they design the new process, what did they reject and why
- Failure & Iteration: what they tried first that didn't work, what they changed
- Impact & Outcomes: efficiency gains, cost reduction, time saved, satisfaction scores
""",
    EvidencePattern.seller: """
Evidence pattern: SELLER
Work signals are deals, accounts, partnerships, pipelines.
- Problem Framing: what customer problem or market gap they were addressing
- Approach & Decisions: how they structured their approach, what strategy they chose over alternatives
- Failure & Iteration: deals lost, approaches that didn't work, how they adapted
- Impact & Outcomes: revenue, quota attainment, deal size, pipeline value, retention
""",
    EvidencePattern.strategist: """
Evidence pattern: STRATEGIST
Work signals are initiatives, decisions, frameworks applied, products shipped.
- Problem Framing: what organisational or market problem they were solving
- Approach & Decisions: how they structured their approach, what they prioritised and why
- Failure & Iteration: decisions that had to be revisited, approaches that failed
- Impact & Outcomes: business outcomes — revenue, growth, efficiency, adoption
""",
    EvidencePattern.communicator: """
Evidence pattern: COMMUNICATOR
Work signals are campaigns, content, audiences reached, messages landed.
- Problem Framing: what audience problem or business goal they were addressing
- Approach & Decisions: how they structured the campaign/content, channel choices with rationale
- Failure & Iteration: what messaging didn't land, what they changed and why
- Impact & Outcomes: reach, engagement, conversion, brand metrics, revenue attribution
""",
}

DEPTH_SYSTEM_PROMPT = """
You are a depth evaluator for a talent intelligence platform covering all career types.

STEP 1 — CLASSIFY FIRST
Before scoring anything, internalize the career archetype from the evidence_pattern provided.
This classification is a HARD CONSTRAINT. Never drift from it during evaluation.

Evidence pattern enforcement:
- builder: evaluate systems, code, deployments, technical decisions
- operator: evaluate processes, workflows, operational improvements, efficiency gains
- seller: evaluate deals, accounts, pipelines, relationships, revenue outcomes
- strategist: evaluate decisions, frameworks, initiatives, outcomes at org level
- communicator: evaluate campaigns, audiences, messages, reach, conversion

NEVER apply engineering vocabulary to non-builder patterns.
NEVER call a process improvement a "project" for an operator.
NEVER evaluate a seller on system architecture.
NEVER evaluate a communicator on technical depth.

STEP 2 — DISTINGUISH EVIDENCE FROM RESPONSIBILITY
A responsibility is NOT evidence. It describes a duty, not an outcome.

Evidence REQUIRES at least one of:
- measurable outcome (reduced X by Y%, increased Z by N)
- named initiative with scope
- shipped or visible artifact
- ownership signal with proof
- implementation detail that shows decision-making

These are responsibilities, NOT evidence:
- "Managed customer escalations"
- "Worked with stakeholders"
- "Supported the team"
- "Responsible for onboarding"

These ARE evidence:
- "Reduced onboarding time by 30% across 120 enterprise accounts"
- "Designed escalation protocol adopted by 5-person team, reducing SLA breaches by 40%"
- "Closed $2M enterprise deal with 18-month contract against 3 competitors"

Score based on what is demonstrated, not what is claimed.
A longer description without measurable depth is weak evidence.
Prioritize specificity, ownership, and outcomes over volume of text.

STEP 3 — SCORE AGAINST THE RUBRIC

Dimension 1 — Problem Framing (1-3)
1: Activity named. No problem context.
2: A problem is named but stays generic.
3: Problem described with specificity — scale, constraint, failure mode, or cost.

Dimension 2 — Decision Thinking (1-3)
1: Actions listed. No reasoning. No choices explained.
2: Some reasoning present but at surface level. No tradeoff context.
3: Decisions described with consequences and rejected alternatives.

Dimension 3 — Adaptability & Learning (1-3)
1: Linear, clean description. Everything worked.
2: A challenge mentioned but vague.
3: Specific failure with cause, consequence, and what the response revealed.

Dimension 4 — Impact & Outcomes (1-3)
1: Activity metrics only or no metrics.
2: Business outcome mentioned but loosely connected to the work.
3: Business outcomes explicit, specific, connected. Before/after present.

SENIORITY CALIBRATION:
- junior: evaluate on execution quality and learning signals
- mid: evaluate on ownership and optimization
- senior: evaluate on strategy, cross-functional influence, measurable org impact
- unknown: evaluate conservatively without penalising for seniority gaps

SIGNAL TYPE CALIBRATION:
When the signal_type is "process" and the signal name contains "—" (e.g. "Qwoted — Content Operations Manager"):
This is a work experience signal, not a side project.
Evaluate it as a body of professional work — 1-2 years of real operational experience.
A role with multiple responsibilities, at least one metric, and cross-functional scope
should score 2/3 on most dimensions even if descriptions are sparse.
Work experience signals deserve more credit than project signals for the same level of detail
because professionals understate their work experience more than their projects.

MISSING DATA RULE:
Absence of evidence is not evidence of absence.
Only score a dimension low when evidence is genuinely absent — not ambiguous.
For work experience signals, sparse descriptions often indicate understatement — not lack of depth.

Return valid JSON only. No markdown. No explanation outside the JSON.
"""

DEPTH_USER_PROMPT = """
Score this work signal against the four rubric dimensions.

{pattern_guidance}

Signal name: {name}
Signal type: {signal_type}
Signal context: {signal_context}
Raw description: {raw_description}

Extracted signals:
- Problem stated: {problem_stated}
- Problem owner: {problem_owner}
- Problem cost: {problem_cost}
- Decisions made: {architectural_decisions}
- Tools/methods with rationale: {tools_with_rationale}
- Tools/methods listed only: {tools_listed_only}
- Failures described: {failures_described}
- Pivots made: {pivots_made}
- Lessons learned: {lessons_learned}
- Activity metrics: {model_metrics}
- Activity/model metrics: {model_metrics}
- Business/impact metrics: {business_metrics}
- Metric connection explicit: {metric_connection_explicit}
- Understatement detected: {understatement_detected}
- Seniority context: {seniority_context}

Return this exact JSON structure:
{{
  "problem_framing": {{"score": 1|2|3, "note": "one sentence: what was present or missing"}},
  "approach_decisions": {{"score": 1|2|3, "note": "one sentence: what was present or missing"}},
  "adaptability_learning": {{"score": 1|2|3, "note": "one sentence: what was present or missing"}},
  "impact_outcomes": {{"score": 1|2|3, "note": "one sentence: what was present or missing"}},
  "score_rationale": "Tone depends on signal_context. Follow exactly: IF signal_context contains 'WORK EXPERIENCE': Start with 'Your [specific achievement from the role] is the strongest signal here.' Then one sentence on what a recruiter would want to know that is currently missing — frame it as what the candidate should add to their CV description for this role, not what the description lacks. Never say 'the description'. Say 'your CV' or 'add to your role at [company]'. IF signal_context contains 'INDEPENDENT PROJECT': Start with what the project demonstrates. Then say what detail would make it credible to a recruiter. BOTH types must end with: 'Instead of: [verbatim weak phrase] Try: [rewrite that adds WHO was affected + WHY this approach over alternatives + WHAT changed downstream]'. The rewrite must be genuinely different — not just longer."
}}
"""


class DepthAgent:
    def __init__(self, client: AsyncOpenAI, model: str = "gpt-4o-mini"):
        self.client = client
        self.model = model

    def _build_signal_context(self, signal: WorkSignal) -> str:
        """Determine what kind of signal this is to calibrate feedback."""
        name = signal.name
        signal_type = signal.signal_type.value

        if " — " in name and signal_type == "process":
            company, role = name.split(" — ", 1)
            return (
                f"WORK EXPERIENCE: This is a professional role at {company}. "
                f"Evaluate as a body of career work, not a project. "
                f"Feedback should tell the candidate how to better describe their professional contributions, "
                f"decisions made, and outcomes achieved in this role."
            )
        elif signal_type in ("project", "general"):
            return (
                f"INDEPENDENT PROJECT: This is a project the candidate built. "
                f"Evaluate the project description quality. "
                f"Feedback should tell the candidate how to improve the project description — "
                f"add the problem it solved, decisions made during development, "
                f"what didn't work, and measurable outcomes."
            )
        elif signal_type == "campaign":
            return (
                f"CAMPAIGN/INITIATIVE: This is a campaign or initiative the candidate ran. "
                f"Evaluate on reach, approach, and measurable impact."
            )
        elif signal_type == "deal":
            return (
                f"DEAL/ACCOUNT: This is a sales or account signal. "
                f"Evaluate on deal context, approach, and revenue outcome."
            )
        else:
            return f"WORK SIGNAL: Evaluate based on evidence pattern and signal type."

    async def score_signal(
        self,
        signal: WorkSignal,
        evidence_pattern: EvidencePattern,
        seniority_context: str = "unknown seniority",
    ) -> ProjectDepthScore:
        pattern_guidance = PATTERN_GUIDANCE.get(
            evidence_pattern,
            PATTERN_GUIDANCE[EvidencePattern.builder]
        )

        response = await self.client.chat.completions.create(
            model=self.model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": DEPTH_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": DEPTH_USER_PROMPT.format(
                        pattern_guidance=pattern_guidance,
                        name=signal.name,
                        signal_type=signal.signal_type.value,
                        signal_context=self._build_signal_context(signal),
                        raw_description=signal.raw_description,
                        problem_stated=signal.problem_stated or "Not stated",
                        problem_owner=signal.problem_owner or "Not stated",
                        problem_cost=signal.problem_cost or "Not stated",
                        architectural_decisions=signal.architectural_decisions or [],
                        tools_with_rationale=signal.tools_with_rationale or [],
                        tools_listed_only=signal.tools_listed_only or [],
                        failures_described=signal.failures_described or [],
                        pivots_made=signal.pivots_made or [],
                        lessons_learned=signal.lessons_learned or [],
                        model_metrics=signal.model_metrics or [],
                        business_metrics=signal.business_metrics or [],
                        metric_connection_explicit=signal.metric_connection_explicit,
                        understatement_detected=signal.understatement_detected,
                        seniority_context=seniority_context,
                    ),
                },
            ],
        )

        data = json.loads(response.choices[0].message.content)

        raw_total = (
            data["problem_framing"]["score"]
            + data["approach_decisions"]["score"]
            + data["adaptability_learning"]["score"]
            + data["impact_outcomes"]["score"]
        )
        depth_score = normalize_score(raw_total)

        return ProjectDepthScore(
            project_name=signal.name,
            problem_framing=DimensionScore(**data["problem_framing"]),
            approach_decisions=DimensionScore(**data["approach_decisions"]),
            adaptability_learning=DimensionScore(**data["adaptability_learning"]),
            impact_outcomes=DimensionScore(**data["impact_outcomes"]),
            raw_total=raw_total,
            depth_score=depth_score,
            label=label_from_score(depth_score),
            score_rationale=data["score_rationale"],
        )

    async def run(self, state: AssayState) -> dict:
        if state.get("error"):
            return {}

        profile = state["profile"]

        if not profile.work_signals:
            return {
                "depth_score": DepthScore(
                    declared_score=0.0,
                    depth_score=0.0,
                    confidence=ConfidenceLevel.low,
                    label=DepthLabel.unclear,
                    missing_signals=["No work signals found in resume"],
                )
            }

        try:
            # Build seniority context string for the prompt
            ss = profile.seniority_signals
            if ss:
                seniority_context = (
                    f"{ss.inferred_level} level ({ss.confidence} confidence). "
                    f"Ownership: {ss.ownership_level}. "
                    f"Reasoning: {ss.reasoning}"
                )
            else:
                seniority_context = "Seniority unclear — evaluate conservatively"

            signal_scores = []
            for signal in profile.work_signals:
                score = await self.score_signal(
                    signal,
                    profile.evidence_pattern,
                    seniority_context=seniority_context,
                )
                signal_scores.append(score)
                logger.info(
                    f"Scored '{signal.name}' [{signal.signal_type}]: "
                    f"{score.depth_score} ({score.label})"
                )

            avg_score = sum(s.depth_score for s in signal_scores) / len(signal_scores)
            declared_score = round(avg_score, 1)

            avg_confidence = sum(
                s.parser_confidence for s in profile.work_signals
            ) / len(profile.work_signals)

            if avg_confidence >= 0.7:
                confidence = ConfidenceLevel.high
            elif avg_confidence >= 0.4:
                confidence = ConfidenceLevel.medium
            else:
                confidence = ConfidenceLevel.low

            missing_signals = []
            if confidence != ConfidenceLevel.high:
                missing_signals.append(
                    "Resume descriptions are sparse — add specific outcomes, "
                    "decisions made, and what you tried first that didn't work."
                )

            sorted_scores = sorted(signal_scores, key=lambda s: s.depth_score)

            return {
                "depth_score": DepthScore(
                    declared_score=declared_score,
                    depth_score=declared_score,
                    confidence=confidence,
                    label=label_from_score(declared_score),
                    project_scores=signal_scores,
                    strongest_project=sorted_scores[-1].project_name,
                    weakest_project=sorted_scores[0].project_name,
                    missing_signals=missing_signals,
                )
            }

        except RateLimitError:
            logger.error("Depth Agent hit OpenAI rate limit")
            return {
                "error": PipelineError(
                    agent="depth_agent",
                    type="RateLimitError",
                    message="OpenAI rate limit exceeded — try again in a few seconds",
                    retryable=True,
                )
            }

        except json.JSONDecodeError as e:
            logger.error(f"Depth Agent received malformed JSON: {e}")
            return {
                "error": PipelineError(
                    agent="depth_agent",
                    type="JSONDecodeError",
                    message="LLM returned malformed JSON — could not parse scoring response",
                    retryable=True,
                )
            }

        except Exception as e:
            logger.error(f"Depth Agent unexpected error: {e}", exc_info=True)
            return {
                "error": PipelineError(
                    agent="depth_agent",
                    type=type(e).__name__,
                    message=str(e),
                    retryable=False,
                )
            }