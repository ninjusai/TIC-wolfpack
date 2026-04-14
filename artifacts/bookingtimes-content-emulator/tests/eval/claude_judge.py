"""
Claude CLI AI Judge — WRK-BCE2-051

Wraps `claude -p` subprocess calls for AI-rubric evaluation.
Sends structured rubric prompts, parses JSON scores from responses.

Modes:
  MOCK_MODE=True  — Returns predetermined scores for CI (no Claude access needed)
  MOCK_MODE=False — Calls `claude -p` subprocess and parses live responses

Environment:
  Set EVAL_LIVE_MODE=1 to disable mock mode and call Claude for real.
"""

import json
import os
import re
import subprocess
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MOCK_MODE = os.environ.get("EVAL_LIVE_MODE", "0") != "1"

CLAUDE_TIMEOUT_SECONDS = 120
CLAUDE_MAX_RETRIES = 2

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


@dataclass
class RubricDimension:
    """A single scoring dimension within a rubric."""

    name: str
    description: str
    min_score: int = 1
    max_score: int = 5


@dataclass
class Rubric:
    """A structured rubric for AI evaluation."""

    eval_id: str
    description: str
    dimensions: list[RubricDimension] = field(default_factory=list)
    threshold: float = 3.5  # Minimum acceptable average score
    scoring_scale: str = "1-5"


@dataclass
class JudgeScore:
    """Result from an AI judge evaluation."""

    eval_id: str
    dimension_scores: dict[str, float]  # dimension_name -> score
    average_score: float
    passed: bool
    reasoning: str
    raw_response: str = ""


# ---------------------------------------------------------------------------
# Mock responses
# ---------------------------------------------------------------------------

# Predetermined scores for each eval case in mock mode.
# These represent "passing" scores so CI tests validate structure, not AI output.
MOCK_SCORES: dict[str, dict[str, float]] = {
    "EVAL-BCE2-019": {
        "tone_alignment": 4.0,
        "vocabulary_consistency": 3.8,
        "formality_match": 4.2,
        "overall_brand_fit": 4.0,
    },
    "EVAL-BCE2-020": {
        "logical_flow": 4.0,
        "no_repetition": 4.5,
        "no_contradictions": 5.0,
        "transition_quality": 3.8,
        "unified_reading": 4.0,
    },
    "EVAL-BCE2-028": {
        "answer_completeness": 4.0,
        "self_contained": 4.2,
        "factual_specificity": 3.8,
        "conciseness": 4.0,
        "citation_readiness": 4.0,
    },
    "EVAL-BCE2-029": {
        "question_naturalness": 4.0,
        "answer_specificity": 3.8,
        "answer_completeness": 4.2,
        "schema_alignment": 4.5,
        "audience_relevance": 4.0,
    },
    "EVAL-BCE2-040": {
        "feedback_addressed": 4.0,
        "terminology_updated": 4.5,
        "style_adapted": 4.0,
        "no_regression": 4.2,
    },
    "EVAL-BCE2-050": {
        "recommendation_specificity": 4.0,
        "actionability": 4.2,
        "page_type_relevance": 3.8,
        "priority_awareness": 4.0,
    },
}

MOCK_REASONING: dict[str, str] = {
    "EVAL-BCE2-019": (
        "The content demonstrates warm, encouraging tone consistent with the brand profile. "
        "Vocabulary aligns with driving school terminology patterns. Formality level matches "
        "the approachable-yet-professional style specified in the profile."
    ),
    "EVAL-BCE2-020": (
        "Sections flow logically from hero to services overview to testimonials. "
        "No repeated sentences detected across sections. No contradictory information found. "
        "Transitions between sections feel natural."
    ),
    "EVAL-BCE2-028": (
        "The direct answer block is 52 words, self-contained, and includes specific details "
        "(TMR approved, 92% pass rate, Brisbane area). It directly answers the implied question "
        "'Where can I get driving lessons in Brisbane?' and is formatted for AI citation."
    ),
    "EVAL-BCE2-029": (
        "FAQ questions are phrased naturally as people would ask AI assistants. "
        "Answers include specific references to TMR, QLD Government requirements, and "
        "concrete pricing. Questions cover common learner driver concerns."
    ),
    "EVAL-BCE2-040": (
        "Post-feedback content shows clear adaptation: shorter sentence lengths after "
        "'use shorter sentences' feedback, correct terminology usage after terminology rules. "
        "No regression in other quality dimensions."
    ),
    "EVAL-BCE2-050": (
        "Recommendations are specific to the page type and include actionable items: "
        "update statistics, refresh FAQ, check for outdated TMR references. "
        "Priority level reflects page importance in the site hierarchy."
    ),
}


# ---------------------------------------------------------------------------
# Prompt assembly
# ---------------------------------------------------------------------------


def build_judge_prompt(
    content: str,
    rubric: Rubric,
    context: str = "",
) -> str:
    """
    Build a structured prompt for the AI judge.

    Args:
        content: The content to evaluate.
        rubric: The rubric defining scoring dimensions and thresholds.
        context: Optional additional context (brand profile, feedback, etc.).

    Returns:
        A prompt string ready to send to `claude -p`.
    """
    dimensions_text = "\n".join(
        f"  - **{d.name}** ({d.min_score}-{d.max_score}): {d.description}"
        for d in rubric.dimensions
    )

    prompt = f"""You are an expert content quality evaluator. Evaluate the following content against the rubric below.

## Eval Case: {rubric.eval_id}
{rubric.description}

## Scoring Rubric (scale: {rubric.scoring_scale})
{dimensions_text}

## Threshold
Average score must be >= {rubric.threshold}

"""
    if context:
        prompt += f"""## Context
{context}

"""

    prompt += f"""## Content to Evaluate
{content}

## Instructions
Score each dimension on the {rubric.scoring_scale} scale. Return ONLY a JSON object with this exact structure:
{{
  "scores": {{
    "<dimension_name>": <numeric_score>,
    ...
  }},
  "reasoning": "<1-3 sentence explanation of scores>"
}}

Return ONLY the JSON object, no other text."""

    return prompt


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------


def parse_judge_response(raw_response: str, rubric: Rubric) -> JudgeScore:
    """
    Parse a Claude response into a structured JudgeScore.

    Handles:
      - Raw JSON
      - JSON inside markdown fences
      - JSON embedded in surrounding text
    """
    # Strip markdown fences if present
    json_text = raw_response
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw_response)
    if fence_match:
        json_text = fence_match.group(1).strip()
    else:
        # Try to find a JSON object directly
        obj_match = re.search(r"\{[\s\S]*\}", raw_response)
        if obj_match:
            json_text = obj_match.group(0)

    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError as e:
        return JudgeScore(
            eval_id=rubric.eval_id,
            dimension_scores={},
            average_score=0.0,
            passed=False,
            reasoning=f"Failed to parse JSON response: {e}",
            raw_response=raw_response,
        )

    scores = parsed.get("scores", {})
    reasoning = parsed.get("reasoning", "")

    # Validate dimension names match rubric
    dimension_names = {d.name for d in rubric.dimensions}
    dimension_scores: dict[str, float] = {}
    for dim_name in dimension_names:
        if dim_name in scores:
            try:
                dimension_scores[dim_name] = float(scores[dim_name])
            except (ValueError, TypeError):
                dimension_scores[dim_name] = 0.0
        else:
            dimension_scores[dim_name] = 0.0

    avg = (
        sum(dimension_scores.values()) / len(dimension_scores)
        if dimension_scores
        else 0.0
    )

    return JudgeScore(
        eval_id=rubric.eval_id,
        dimension_scores=dimension_scores,
        average_score=round(avg, 2),
        passed=avg >= rubric.threshold,
        reasoning=reasoning,
        raw_response=raw_response,
    )


# ---------------------------------------------------------------------------
# Claude CLI subprocess
# ---------------------------------------------------------------------------


def call_claude_cli(prompt: str) -> str:
    """
    Call `claude -p` as a subprocess with the given prompt.
    Pipes prompt via stdin and captures stdout.

    Returns:
        The raw response string from Claude.

    Raises:
        RuntimeError: If the subprocess fails or times out.
    """
    for attempt in range(1, CLAUDE_MAX_RETRIES + 1):
        try:
            result = subprocess.run(
                ["claude", "-p"],
                input=prompt,
                capture_output=True,
                text=True,
                timeout=CLAUDE_TIMEOUT_SECONDS,
                shell=True,  # Required on Windows to resolve `claude` via PATH
            )

            if result.returncode != 0:
                stderr = result.stderr.strip()[:500]
                if attempt < CLAUDE_MAX_RETRIES:
                    continue
                raise RuntimeError(
                    f"Claude CLI exited with code {result.returncode}: {stderr}"
                )

            response = result.stdout.strip()
            if not response:
                if attempt < CLAUDE_MAX_RETRIES:
                    continue
                raise RuntimeError("Claude CLI returned empty response")

            return response

        except subprocess.TimeoutExpired:
            if attempt < CLAUDE_MAX_RETRIES:
                continue
            raise RuntimeError(
                f"Claude CLI timed out after {CLAUDE_TIMEOUT_SECONDS}s"
            )

    raise RuntimeError(f"All {CLAUDE_MAX_RETRIES} attempts failed")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def evaluate(
    content: str,
    rubric: Rubric,
    context: str = "",
) -> JudgeScore:
    """
    Evaluate content against a rubric using the AI judge.

    In MOCK_MODE, returns predetermined scores.
    In live mode, calls `claude -p` and parses the response.

    Args:
        content: The content to evaluate.
        rubric: The rubric with dimensions and thresholds.
        context: Optional additional context.

    Returns:
        A JudgeScore with dimension scores, average, and pass/fail.
    """
    if MOCK_MODE:
        return _mock_evaluate(rubric)

    prompt = build_judge_prompt(content, rubric, context)
    raw_response = call_claude_cli(prompt)
    return parse_judge_response(raw_response, rubric)


def _mock_evaluate(rubric: Rubric) -> JudgeScore:
    """Return predetermined mock scores for CI testing."""
    mock_scores = MOCK_SCORES.get(rubric.eval_id, {})
    mock_reason = MOCK_REASONING.get(rubric.eval_id, "Mock evaluation — no AI call made.")

    # Build dimension scores from mock data, falling back to 4.0 for unknown dimensions
    dimension_scores: dict[str, float] = {}
    for dim in rubric.dimensions:
        dimension_scores[dim.name] = mock_scores.get(dim.name, 4.0)

    avg = (
        sum(dimension_scores.values()) / len(dimension_scores)
        if dimension_scores
        else 0.0
    )

    return JudgeScore(
        eval_id=rubric.eval_id,
        dimension_scores=dimension_scores,
        average_score=round(avg, 2),
        passed=avg >= rubric.threshold,
        reasoning=mock_reason,
        raw_response="[MOCK MODE]",
    )


def validate_rubric(rubric: Rubric) -> list[str]:
    """
    Validate a rubric definition for structural correctness.

    Returns a list of errors (empty if valid).
    """
    errors: list[str] = []

    if not rubric.eval_id:
        errors.append("Rubric must have an eval_id")

    if not rubric.description:
        errors.append("Rubric must have a description")

    if not rubric.dimensions:
        errors.append("Rubric must have at least one dimension")

    for dim in rubric.dimensions:
        if not dim.name:
            errors.append("Dimension must have a name")
        if not dim.description:
            errors.append(f"Dimension '{dim.name}' must have a description")
        if dim.min_score >= dim.max_score:
            errors.append(
                f"Dimension '{dim.name}' min_score ({dim.min_score}) must be less than max_score ({dim.max_score})"
            )

    if rubric.threshold <= 0:
        errors.append("Threshold must be positive")

    return errors
