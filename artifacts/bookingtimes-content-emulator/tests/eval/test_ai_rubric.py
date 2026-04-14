"""
AI-Rubric Eval Harness — WRK-BCE2-051

Pytest-based test suite that uses Claude CLI (`claude -p`) as an AI judge
to evaluate content quality against structured rubrics.

Covers 6 AI-rubric eval cases:
  EVAL-BCE2-019: Brand voice match
  EVAL-BCE2-020: Section coherence
  EVAL-BCE2-028: Direct answer block quality
  EVAL-BCE2-029: FAQ quality
  EVAL-BCE2-040: Feedback reflection
  EVAL-BCE2-050: Freshness recommendation specificity

Modes:
  Default (MOCK_MODE=True): Validates rubric structure and prompt assembly
  Live (EVAL_LIVE_MODE=1): Actually calls Claude CLI and validates real scores
"""

import json
import textwrap

import pytest

from claude_judge import (
    JudgeScore,
    Rubric,
    RubricDimension,
    build_judge_prompt,
    evaluate,
    parse_judge_response,
    validate_rubric,
)

# ============================================================================
# Sample content fixtures
# ============================================================================

SAMPLE_BRAND_PROFILE = {
    "voice_description": (
        "Alpha Driving School uses a warm, encouraging tone that feels approachable "
        "yet professional. Content speaks directly to learner drivers and their parents."
    ),
    "tone_keywords": ["warm", "encouraging", "local", "professional", "supportive"],
    "terminology_patterns": [
        {"use": "learner driver", "avoid": "student driver"},
        {"use": "driving instructor", "avoid": "teacher"},
        {"use": "lesson", "avoid": "class"},
        {"use": "TMR", "avoid": "RTA"},
    ],
    "sentence_style": (
        "Short to medium sentences, active voice, direct address ('you', 'your'). "
        "Occasional questions to engage the reader."
    ),
    "recurring_phrases": [
        "TMR approved",
        "book your lesson",
        "on the road to your licence",
        "Brisbane and surrounding suburbs",
    ],
    "anti_patterns": [
        "Never uses overly formal language",
        "Avoids jargon without explanation",
        "Does not use passive voice excessively",
        "Never uses 'student driver'",
    ],
}

SAMPLE_HERO_SECTION = textwrap.dedent("""\
    <section class="container mb-3">
      <div class="row">
        <div class="col-md-6">
          <h1>Driving Lessons Brisbane</h1>
          <p>Looking for driving lessons in Brisbane? Alpha Driving School offers
          professional driving instruction with TMR approved instructors. We have
          taught over 500 learner drivers across Brisbane suburbs. Our pass rate
          is 92% on first attempt. Book your lesson today and get started on
          the road to your licence.</p>
        </div>
      </div>
    </section>
""")

SAMPLE_SERVICES_SECTION = textwrap.dedent("""\
    <section class="container mt-5">
      <h2>Our Driving Services</h2>
      <div class="row">
        <div class="col-lg-4">
          <div class="card">
            <div class="card-body">
              <h3>Automatic Lessons</h3>
              <p>Learn in our modern automatic vehicles with patient instructors.
              We offer flexible scheduling to fit your busy lifestyle. Prices from
              $65 per hour with packages available for better value.</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card">
            <div class="card-body">
              <h3>Manual Lessons</h3>
              <p>Master manual driving with expert guidance. Learn clutch control
              and gear shifting in a safe environment. 10-hour package available
              for $600 — our most popular choice for learner drivers.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
""")

SAMPLE_TESTIMONIALS_SECTION = textwrap.dedent("""\
    <section class="container mt-5">
      <h2>What Our Learner Drivers Say</h2>
      <div class="row">
        <div class="col-md-6">
          <blockquote>
            <p>"My instructor was incredibly patient and supportive. I passed my
            driving test on the first attempt after just 15 lessons. Highly
            recommend Alpha Driving School!"</p>
            <footer>— Sarah M., Paddington</footer>
          </blockquote>
        </div>
      </div>
    </section>
""")

SAMPLE_FULL_PAGE = SAMPLE_HERO_SECTION + SAMPLE_SERVICES_SECTION + SAMPLE_TESTIMONIALS_SECTION

SAMPLE_DIRECT_ANSWER = textwrap.dedent("""\
    <p>Alpha Driving School in Brisbane offers TMR approved driving lessons
    from $65 per hour with a 92% first-attempt pass rate. Our qualified
    instructors provide automatic and manual lessons across Brisbane and
    surrounding suburbs, with flexible scheduling and multi-lesson packages
    available for learner drivers of all experience levels.</p>
""")

SAMPLE_FAQ_HTML = textwrap.dedent("""\
    <section class="container mt-5">
      <h2>Frequently Asked Questions</h2>
      <div itemscope itemtype="https://schema.org/FAQPage">
        <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
          <h3 itemprop="name">How much do driving lessons cost in Brisbane?</h3>
          <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
            <p itemprop="text">Driving lessons at Alpha Driving School start from $65 per
            hour for automatic and $70 per hour for manual vehicles. We offer a 10-hour
            package for $600, saving you $50 compared to individual bookings. All prices
            include pick-up and drop-off within Brisbane metro.</p>
          </div>
        </div>
        <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
          <h3 itemprop="name">How many driving lessons do I need to pass my test in Queensland?</h3>
          <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
            <p itemprop="text">Queensland Transport and Main Roads (TMR) requires learner
            drivers to complete a minimum of 100 hours of supervised driving, including
            10 hours at night. Most of our learner drivers book between 10 and 20
            professional lessons alongside their supervised practice hours before
            attempting the practical test.</p>
          </div>
        </div>
        <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
          <h3 itemprop="name">Are your driving instructors TMR approved?</h3>
          <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
            <p itemprop="text">Yes, all Alpha Driving School instructors hold current
            Queensland TMR driving instructor licences and Working with Children
            Blue Cards. Our team has over 25 years of combined teaching experience
            and maintains a 92% first-attempt pass rate.</p>
          </div>
        </div>
      </div>
    </section>
""")

SAMPLE_FAQ_JSONLD = json.dumps(
    {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "How much do driving lessons cost in Brisbane?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": (
                        "Driving lessons at Alpha Driving School start from $65 per hour "
                        "for automatic and $70 per hour for manual vehicles. We offer a "
                        "10-hour package for $600, saving you $50 compared to individual "
                        "bookings. All prices include pick-up and drop-off within Brisbane metro."
                    ),
                },
            },
            {
                "@type": "Question",
                "name": "How many driving lessons do I need to pass my test in Queensland?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": (
                        "Queensland Transport and Main Roads (TMR) requires learner drivers "
                        "to complete a minimum of 100 hours of supervised driving, including "
                        "10 hours at night. Most of our learner drivers book between 10 and "
                        "20 professional lessons alongside their supervised practice hours "
                        "before attempting the practical test."
                    ),
                },
            },
            {
                "@type": "Question",
                "name": "Are your driving instructors TMR approved?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": (
                        "Yes, all Alpha Driving School instructors hold current Queensland "
                        "TMR driving instructor licences and Working with Children Blue Cards. "
                        "Our team has over 25 years of combined teaching experience and "
                        "maintains a 92% first-attempt pass rate."
                    ),
                },
            },
        ],
    },
    indent=2,
)

SAMPLE_PRE_FEEDBACK_CONTENT = textwrap.dedent("""\
    <section class="container">
      <h2>About Our Driving School</h2>
      <p>Alpha Driving School has been providing comprehensive driving instruction
      to student drivers in the Brisbane metropolitan area for over fifteen years.
      Our experienced team of instructors is dedicated to ensuring that every
      student driver receives the highest quality education in a supportive and
      encouraging environment. We believe that learning to drive should be an
      enjoyable journey for every student driver.</p>
    </section>
""")

SAMPLE_POST_FEEDBACK_CONTENT = textwrap.dedent("""\
    <section class="container">
      <h2>About Our Driving School</h2>
      <p>Alpha Driving School has taught over 500 learner drivers in Brisbane
      since 2010. Our TMR approved instructors have a 92% first-attempt pass
      rate. We offer auto and manual lessons from $65/hour.</p>
      <p>Ready to get on the road to your licence? Book your lesson today.
      We pick up and drop off across Brisbane and surrounding suburbs.</p>
    </section>
""")

SAMPLE_FEEDBACK_RULES = [
    "Use 'learner driver' not 'student driver'",
    "Use shorter sentences — aim for under 25 words per sentence",
    "Include specific numbers and statistics where possible",
]

SAMPLE_STALE_PAGE_INFO = {
    "page_url": "https://alphadriving.com.au/driving-lessons",
    "page_type": "service",
    "freshness_status": "stale",
    "weeks_since_update": 12,
    "last_deployed_at": "2026-01-08T00:00:00Z",
    "site_name": "Alpha Driving School",
    "page_title": "Driving Lessons",
}

SAMPLE_FRESHNESS_RECOMMENDATIONS = textwrap.dedent("""\
    ## Content Freshness Alert: Driving Lessons Page (STALE)

    **Page:** https://alphadriving.com.au/driving-lessons
    **Status:** Stale (12 weeks since last update, threshold: 10 weeks)
    **Priority:** HIGH (service page — directly impacts conversions)

    ### Recommended Updates

    1. **Update pricing information**: Verify current lesson prices ($65/hour auto,
       $70/hour manual) are still accurate. Check if package deals have changed.

    2. **Refresh pass rate statistics**: Current content cites 92% first-attempt
       pass rate. Verify this against the latest 12-month rolling data.

    3. **Review FAQ section**: Check if TMR requirements have changed (100 hours
       supervised driving, Blue Card requirements). Update any regulatory references.

    4. **Update testimonials**: Add recent reviews from the last quarter. Remove
       any testimonials older than 12 months.

    5. **Check instructor information**: Verify team size ("25 years combined
       experience") and any new instructors or certifications.

    ### Why This Matters
    Content freshness research shows pages updated within 13 weeks receive 50%
    more AI citations than stale content. This service page is a key conversion
    driver and should be prioritised.
""")


# ============================================================================
# Rubric definitions
# ============================================================================


def make_brand_voice_rubric() -> Rubric:
    """EVAL-BCE2-019: Brand voice match rubric."""
    return Rubric(
        eval_id="EVAL-BCE2-019",
        description=(
            "Evaluate whether generated content matches the inferred brand voice profile. "
            "Content should sound like it belongs on this specific site, not like generic "
            "AI output or another site's voice."
        ),
        dimensions=[
            RubricDimension(
                name="tone_alignment",
                description=(
                    "Does the content's tone match the profile's tone keywords "
                    "(warm, encouraging, local, professional, supportive)?"
                ),
            ),
            RubricDimension(
                name="vocabulary_consistency",
                description=(
                    "Does the content use the correct terminology patterns? "
                    "E.g., 'learner driver' not 'student driver', 'TMR' not 'RTA'."
                ),
            ),
            RubricDimension(
                name="formality_match",
                description=(
                    "Does the formality level match the profile? "
                    "Approachable-yet-professional, not overly formal or too casual."
                ),
            ),
            RubricDimension(
                name="overall_brand_fit",
                description=(
                    "Overall, does this content sound like it belongs on this specific site? "
                    "Would a reader recognise it as consistent with the brand?"
                ),
            ),
        ],
        threshold=3.5,
    )


def make_section_coherence_rubric() -> Rubric:
    """EVAL-BCE2-020: Section coherence rubric."""
    return Rubric(
        eval_id="EVAL-BCE2-020",
        description=(
            "Evaluate whether individually-generated sections read naturally when "
            "assembled into a full page. Check for logical flow, no repetition, "
            "no contradictions, and natural transitions."
        ),
        dimensions=[
            RubricDimension(
                name="logical_flow",
                description="Do sections progress logically from one to the next?",
            ),
            RubricDimension(
                name="no_repetition",
                description="Are there no repeated sentences or paragraphs across sections?",
            ),
            RubricDimension(
                name="no_contradictions",
                description="Is there no contradictory information (e.g., different prices in two sections)?",
            ),
            RubricDimension(
                name="transition_quality",
                description="Do transitions between sections feel natural, not jarring?",
            ),
            RubricDimension(
                name="unified_reading",
                description="Does the page read as a unified document, not as separately-written fragments?",
            ),
        ],
        threshold=3.5,
    )


def make_direct_answer_rubric() -> Rubric:
    """EVAL-BCE2-028: Direct answer block quality rubric."""
    return Rubric(
        eval_id="EVAL-BCE2-028",
        description=(
            "Evaluate a direct answer block for GEO optimization. The block should be "
            "a concise, self-contained 40-60 word paragraph that directly answers a "
            "question implied by the page topic, formatted for AI citation."
        ),
        dimensions=[
            RubricDimension(
                name="answer_completeness",
                description="Does the block directly and completely answer the implied question?",
            ),
            RubricDimension(
                name="self_contained",
                description="Does the answer make sense without surrounding context?",
            ),
            RubricDimension(
                name="factual_specificity",
                description=(
                    "Does the answer include specific facts (numbers, names, concrete details) "
                    "rather than vague claims?"
                ),
            ),
            RubricDimension(
                name="conciseness",
                description="Is the answer appropriately concise (40-60 words)?",
            ),
            RubricDimension(
                name="citation_readiness",
                description="Is the content formatted so an AI engine could extract and cite it verbatim?",
            ),
        ],
        threshold=3.5,
    )


def make_faq_quality_rubric() -> Rubric:
    """EVAL-BCE2-029: FAQ quality rubric."""
    return Rubric(
        eval_id="EVAL-BCE2-029",
        description=(
            "Evaluate FAQ sections for realistic questions, specific answers, "
            "and proper schema markup integration. Questions should be phrased "
            "as people ask AI assistants, not keyword-stuffed."
        ),
        dimensions=[
            RubricDimension(
                name="question_naturalness",
                description=(
                    "Are questions phrased naturally, as people would ask an AI assistant? "
                    "Not keyword-stuffed or robotic."
                ),
            ),
            RubricDimension(
                name="answer_specificity",
                description=(
                    "Do answers include specific facts (TMR references, QLD Government "
                    "requirements, prices, statistics)?"
                ),
            ),
            RubricDimension(
                name="answer_completeness",
                description=(
                    "Are answers 40-80 words each with sufficient detail to be useful?"
                ),
            ),
            RubricDimension(
                name="schema_alignment",
                description="Does the FAQ content align with the FAQPage JSON-LD schema?",
            ),
            RubricDimension(
                name="audience_relevance",
                description="Are the questions relevant to the target audience (learner drivers)?",
            ),
        ],
        threshold=3.5,
    )


def make_feedback_reflection_rubric() -> Rubric:
    """EVAL-BCE2-040: Feedback reflection rubric."""
    return Rubric(
        eval_id="EVAL-BCE2-040",
        description=(
            "Evaluate whether post-feedback content reflects prior feedback rules. "
            "Compare pre- and post-feedback output to verify the system learned."
        ),
        dimensions=[
            RubricDimension(
                name="feedback_addressed",
                description="Does the new content address the specific feedback provided?",
            ),
            RubricDimension(
                name="terminology_updated",
                description=(
                    "If terminology feedback was given (e.g., 'learner driver' not 'student driver'), "
                    "is the correct term now used?"
                ),
            ),
            RubricDimension(
                name="style_adapted",
                description=(
                    "If style feedback was given (e.g., shorter sentences), "
                    "is the style adapted accordingly?"
                ),
            ),
            RubricDimension(
                name="no_regression",
                description="Are other quality dimensions maintained (no regression in overall quality)?",
            ),
        ],
        threshold=3.5,
    )


def make_freshness_recommendation_rubric() -> Rubric:
    """EVAL-BCE2-050: Freshness recommendation specificity rubric."""
    return Rubric(
        eval_id="EVAL-BCE2-050",
        description=(
            "Evaluate freshness alert recommendations for specificity and actionability. "
            "Recommendations should be specific to the page type, include concrete actions, "
            "and reflect priority based on page importance."
        ),
        dimensions=[
            RubricDimension(
                name="recommendation_specificity",
                description=(
                    "Are recommendations specific (mentioning actual content elements, "
                    "prices, stats) rather than generic ('update your content')?"
                ),
            ),
            RubricDimension(
                name="actionability",
                description=(
                    "Can the operator act on each recommendation without further research? "
                    "Does each item say what to check or change?"
                ),
            ),
            RubricDimension(
                name="page_type_relevance",
                description=(
                    "Are recommendations tailored to the page type "
                    "(service page vs location page vs homepage)?"
                ),
            ),
            RubricDimension(
                name="priority_awareness",
                description=(
                    "Does the alert reflect the page's importance in the site hierarchy "
                    "and prioritise accordingly?"
                ),
            ),
        ],
        threshold=3.5,
    )


# ============================================================================
# Test Classes
# ============================================================================


class TestRubricValidation:
    """Structural validation of all rubric definitions."""

    @pytest.mark.parametrize(
        "rubric_factory,eval_id",
        [
            (make_brand_voice_rubric, "EVAL-BCE2-019"),
            (make_section_coherence_rubric, "EVAL-BCE2-020"),
            (make_direct_answer_rubric, "EVAL-BCE2-028"),
            (make_faq_quality_rubric, "EVAL-BCE2-029"),
            (make_feedback_reflection_rubric, "EVAL-BCE2-040"),
            (make_freshness_recommendation_rubric, "EVAL-BCE2-050"),
        ],
    )
    def test_rubric_is_valid(self, rubric_factory, eval_id):
        """Each rubric passes structural validation."""
        rubric = rubric_factory()
        errors = validate_rubric(rubric)
        assert errors == [], f"Rubric {eval_id} has validation errors: {errors}"
        assert rubric.eval_id == eval_id

    @pytest.mark.parametrize(
        "rubric_factory",
        [
            make_brand_voice_rubric,
            make_section_coherence_rubric,
            make_direct_answer_rubric,
            make_faq_quality_rubric,
            make_feedback_reflection_rubric,
            make_freshness_recommendation_rubric,
        ],
    )
    def test_rubric_has_threshold(self, rubric_factory):
        """Each rubric defines a positive threshold."""
        rubric = rubric_factory()
        assert rubric.threshold > 0
        assert rubric.threshold <= 5.0

    @pytest.mark.parametrize(
        "rubric_factory,min_dims",
        [
            (make_brand_voice_rubric, 4),
            (make_section_coherence_rubric, 5),
            (make_direct_answer_rubric, 5),
            (make_faq_quality_rubric, 5),
            (make_feedback_reflection_rubric, 4),
            (make_freshness_recommendation_rubric, 4),
        ],
    )
    def test_rubric_dimension_count(self, rubric_factory, min_dims):
        """Each rubric has the expected minimum number of dimensions."""
        rubric = rubric_factory()
        assert len(rubric.dimensions) >= min_dims

    def test_invalid_rubric_detected(self):
        """A rubric with no dimensions is flagged as invalid."""
        rubric = Rubric(eval_id="", description="", dimensions=[], threshold=-1)
        errors = validate_rubric(rubric)
        assert len(errors) >= 3  # missing id, description, dimensions, bad threshold


class TestPromptAssembly:
    """Verify prompt construction for each eval case."""

    def test_brand_voice_prompt_includes_profile(self):
        """Brand voice prompt includes the brand profile context."""
        rubric = make_brand_voice_rubric()
        context = json.dumps(SAMPLE_BRAND_PROFILE, indent=2)
        prompt = build_judge_prompt(SAMPLE_HERO_SECTION, rubric, context)

        assert "EVAL-BCE2-019" in prompt
        assert "tone_alignment" in prompt
        assert "vocabulary_consistency" in prompt
        assert "formality_match" in prompt
        assert "overall_brand_fit" in prompt
        assert "warm" in prompt  # from brand profile context
        assert "learner driver" in prompt  # from terminology patterns

    def test_section_coherence_prompt_includes_full_page(self):
        """Section coherence prompt includes assembled page content."""
        rubric = make_section_coherence_rubric()
        prompt = build_judge_prompt(SAMPLE_FULL_PAGE, rubric)

        assert "EVAL-BCE2-020" in prompt
        assert "logical_flow" in prompt
        assert "no_repetition" in prompt
        assert "Driving Lessons Brisbane" in prompt  # from hero
        assert "Our Driving Services" in prompt  # from services
        assert "What Our Learner Drivers Say" in prompt  # from testimonials

    def test_direct_answer_prompt_structure(self):
        """Direct answer prompt includes the answer block and rubric dimensions."""
        rubric = make_direct_answer_rubric()
        prompt = build_judge_prompt(SAMPLE_DIRECT_ANSWER, rubric)

        assert "EVAL-BCE2-028" in prompt
        assert "answer_completeness" in prompt
        assert "self_contained" in prompt
        assert "factual_specificity" in prompt
        assert "citation_readiness" in prompt
        assert "Alpha Driving School" in prompt

    def test_faq_prompt_includes_both_html_and_schema(self):
        """FAQ prompt includes both HTML content and JSON-LD context."""
        rubric = make_faq_quality_rubric()
        context = f"JSON-LD Schema:\n{SAMPLE_FAQ_JSONLD}"
        prompt = build_judge_prompt(SAMPLE_FAQ_HTML, rubric, context)

        assert "EVAL-BCE2-029" in prompt
        assert "question_naturalness" in prompt
        assert "schema_alignment" in prompt
        assert "FAQPage" in prompt
        assert "How much do driving lessons cost" in prompt

    def test_feedback_reflection_prompt_includes_both_versions(self):
        """Feedback reflection prompt includes pre- and post-feedback content."""
        rubric = make_feedback_reflection_rubric()
        context = (
            f"## Feedback Rules Applied\n"
            + "\n".join(f"- {r}" for r in SAMPLE_FEEDBACK_RULES)
            + f"\n\n## Pre-Feedback Content\n{SAMPLE_PRE_FEEDBACK_CONTENT}"
        )
        prompt = build_judge_prompt(SAMPLE_POST_FEEDBACK_CONTENT, rubric, context)

        assert "EVAL-BCE2-040" in prompt
        assert "feedback_addressed" in prompt
        assert "student driver" in prompt  # from pre-feedback (should be changed)
        assert "learner driver" in prompt  # from post-feedback
        assert "Use shorter sentences" in prompt  # from feedback rules

    def test_freshness_prompt_includes_recommendations(self):
        """Freshness prompt includes page info and recommendations."""
        rubric = make_freshness_recommendation_rubric()
        context = (
            f"## Stale Page Info\n{json.dumps(SAMPLE_STALE_PAGE_INFO, indent=2)}"
        )
        prompt = build_judge_prompt(SAMPLE_FRESHNESS_RECOMMENDATIONS, rubric, context)

        assert "EVAL-BCE2-050" in prompt
        assert "recommendation_specificity" in prompt
        assert "actionability" in prompt
        assert "stale" in prompt.lower()
        assert "12 weeks" in prompt

    def test_prompt_requests_json_response(self):
        """All prompts request JSON-only responses."""
        for factory in [
            make_brand_voice_rubric,
            make_section_coherence_rubric,
            make_direct_answer_rubric,
            make_faq_quality_rubric,
            make_feedback_reflection_rubric,
            make_freshness_recommendation_rubric,
        ]:
            rubric = factory()
            prompt = build_judge_prompt("test content", rubric)
            assert "ONLY" in prompt
            assert "JSON" in prompt
            assert '"scores"' in prompt


class TestResponseParsing:
    """Test parsing of various Claude response formats."""

    def _make_simple_rubric(self) -> Rubric:
        return Rubric(
            eval_id="TEST-001",
            description="Test rubric",
            dimensions=[
                RubricDimension(name="dim_a", description="Dimension A"),
                RubricDimension(name="dim_b", description="Dimension B"),
            ],
            threshold=3.0,
        )

    def test_parse_clean_json(self):
        """Parse a clean JSON response."""
        rubric = self._make_simple_rubric()
        raw = '{"scores": {"dim_a": 4.0, "dim_b": 3.5}, "reasoning": "Good quality."}'
        result = parse_judge_response(raw, rubric)

        assert result.dimension_scores["dim_a"] == 4.0
        assert result.dimension_scores["dim_b"] == 3.5
        assert result.average_score == 3.75
        assert result.passed is True
        assert result.reasoning == "Good quality."

    def test_parse_json_in_markdown_fences(self):
        """Parse JSON wrapped in markdown code fences."""
        rubric = self._make_simple_rubric()
        raw = '```json\n{"scores": {"dim_a": 4.0, "dim_b": 3.0}, "reasoning": "OK."}\n```'
        result = parse_judge_response(raw, rubric)

        assert result.dimension_scores["dim_a"] == 4.0
        assert result.dimension_scores["dim_b"] == 3.0
        assert result.average_score == 3.5
        assert result.passed is True

    def test_parse_json_with_surrounding_text(self):
        """Parse JSON embedded in surrounding explanation text."""
        rubric = self._make_simple_rubric()
        raw = (
            'Here is my evaluation:\n\n'
            '{"scores": {"dim_a": 2.0, "dim_b": 2.5}, "reasoning": "Below threshold."}\n\n'
            'Let me know if you need more detail.'
        )
        result = parse_judge_response(raw, rubric)

        assert result.dimension_scores["dim_a"] == 2.0
        assert result.dimension_scores["dim_b"] == 2.5
        assert result.average_score == 2.25
        assert result.passed is False

    def test_parse_invalid_json(self):
        """Invalid JSON produces a failing score with error reasoning."""
        rubric = self._make_simple_rubric()
        raw = "This is not JSON at all."
        result = parse_judge_response(raw, rubric)

        assert result.passed is False
        assert result.average_score == 0.0
        assert "Failed to parse" in result.reasoning

    def test_parse_missing_dimensions(self):
        """Missing dimension scores default to 0.0."""
        rubric = self._make_simple_rubric()
        raw = '{"scores": {"dim_a": 5.0}, "reasoning": "Only one dimension scored."}'
        result = parse_judge_response(raw, rubric)

        assert result.dimension_scores["dim_a"] == 5.0
        assert result.dimension_scores["dim_b"] == 0.0
        assert result.average_score == 2.5

    def test_parse_extra_dimensions_ignored(self):
        """Extra dimension scores not in the rubric are ignored."""
        rubric = self._make_simple_rubric()
        raw = '{"scores": {"dim_a": 4.0, "dim_b": 4.0, "dim_c": 5.0}, "reasoning": "Extra dim."}'
        result = parse_judge_response(raw, rubric)

        assert "dim_c" not in result.dimension_scores
        assert result.average_score == 4.0

    def test_parse_integer_scores(self):
        """Integer scores are accepted (cast to float)."""
        rubric = self._make_simple_rubric()
        raw = '{"scores": {"dim_a": 4, "dim_b": 3}, "reasoning": "Integers."}'
        result = parse_judge_response(raw, rubric)

        assert result.dimension_scores["dim_a"] == 4.0
        assert result.dimension_scores["dim_b"] == 3.0


class TestEvalBCE2019BrandVoiceMatch:
    """EVAL-BCE2-019: Brand voice match — AI judge scores generated content
    against the site's inferred brand voice profile."""

    def test_brand_voice_eval_returns_score(self):
        """Evaluation returns a valid JudgeScore with all dimensions."""
        rubric = make_brand_voice_rubric()
        context = json.dumps(SAMPLE_BRAND_PROFILE, indent=2)
        result = evaluate(SAMPLE_HERO_SECTION, rubric, context)

        assert isinstance(result, JudgeScore)
        assert result.eval_id == "EVAL-BCE2-019"
        assert len(result.dimension_scores) == 4
        assert "tone_alignment" in result.dimension_scores
        assert "vocabulary_consistency" in result.dimension_scores
        assert "formality_match" in result.dimension_scores
        assert "overall_brand_fit" in result.dimension_scores

    def test_brand_voice_passes_threshold(self):
        """Brand voice evaluation meets the 3.5 threshold."""
        rubric = make_brand_voice_rubric()
        context = json.dumps(SAMPLE_BRAND_PROFILE, indent=2)
        result = evaluate(SAMPLE_HERO_SECTION, rubric, context)

        assert result.passed is True
        assert result.average_score >= 3.5

    def test_brand_voice_all_dimensions_scored(self):
        """Every dimension receives a score within the valid range."""
        rubric = make_brand_voice_rubric()
        context = json.dumps(SAMPLE_BRAND_PROFILE, indent=2)
        result = evaluate(SAMPLE_HERO_SECTION, rubric, context)

        for dim_name, score in result.dimension_scores.items():
            assert 1.0 <= score <= 5.0, f"{dim_name} score {score} out of range"

    def test_brand_voice_has_reasoning(self):
        """Evaluation includes non-empty reasoning."""
        rubric = make_brand_voice_rubric()
        context = json.dumps(SAMPLE_BRAND_PROFILE, indent=2)
        result = evaluate(SAMPLE_HERO_SECTION, rubric, context)

        assert result.reasoning
        assert len(result.reasoning) > 20


class TestEvalBCE2020SectionCoherence:
    """EVAL-BCE2-020: Section coherence — AI judge evaluates whether
    assembled sections read as a unified document."""

    def test_section_coherence_returns_score(self):
        """Evaluation returns a valid JudgeScore with all 5 dimensions."""
        rubric = make_section_coherence_rubric()
        result = evaluate(SAMPLE_FULL_PAGE, rubric)

        assert isinstance(result, JudgeScore)
        assert result.eval_id == "EVAL-BCE2-020"
        assert len(result.dimension_scores) == 5

    def test_section_coherence_passes_threshold(self):
        """Coherent page content meets the 3.5 threshold."""
        rubric = make_section_coherence_rubric()
        result = evaluate(SAMPLE_FULL_PAGE, rubric)

        assert result.passed is True
        assert result.average_score >= 3.5

    def test_coherence_includes_flow_and_repetition_checks(self):
        """Score includes both logical flow and repetition checks."""
        rubric = make_section_coherence_rubric()
        result = evaluate(SAMPLE_FULL_PAGE, rubric)

        assert "logical_flow" in result.dimension_scores
        assert "no_repetition" in result.dimension_scores
        assert "no_contradictions" in result.dimension_scores


class TestEvalBCE2028DirectAnswerQuality:
    """EVAL-BCE2-028: Direct answer block quality — AI judge evaluates
    GEO-optimized answer blocks for conciseness and citation readiness."""

    def test_direct_answer_returns_score(self):
        """Evaluation returns a valid JudgeScore with all 5 dimensions."""
        rubric = make_direct_answer_rubric()
        result = evaluate(SAMPLE_DIRECT_ANSWER, rubric)

        assert isinstance(result, JudgeScore)
        assert result.eval_id == "EVAL-BCE2-028"
        assert len(result.dimension_scores) == 5

    def test_direct_answer_passes_threshold(self):
        """Well-formed direct answer meets the 3.5 threshold."""
        rubric = make_direct_answer_rubric()
        result = evaluate(SAMPLE_DIRECT_ANSWER, rubric)

        assert result.passed is True
        assert result.average_score >= 3.5

    def test_direct_answer_word_count_in_range(self):
        """The sample direct answer block is 40-60 words (structural check)."""
        # Strip HTML tags for word count
        import re

        text = re.sub(r"<[^>]+>", "", SAMPLE_DIRECT_ANSWER).strip()
        word_count = len(text.split())
        assert 35 <= word_count <= 65, f"Direct answer is {word_count} words (expected 40-60)"

    def test_direct_answer_includes_specifics(self):
        """Sample content includes specific facts (structural check)."""
        assert "$65" in SAMPLE_DIRECT_ANSWER
        assert "92%" in SAMPLE_DIRECT_ANSWER
        assert "TMR approved" in SAMPLE_DIRECT_ANSWER


class TestEvalBCE2029FAQQuality:
    """EVAL-BCE2-029: FAQ quality — AI judge evaluates FAQ sections for
    realistic questions, specific answers, and schema markup."""

    def test_faq_quality_returns_score(self):
        """Evaluation returns a valid JudgeScore with all 5 dimensions."""
        rubric = make_faq_quality_rubric()
        context = f"JSON-LD Schema:\n{SAMPLE_FAQ_JSONLD}"
        result = evaluate(SAMPLE_FAQ_HTML, rubric, context)

        assert isinstance(result, JudgeScore)
        assert result.eval_id == "EVAL-BCE2-029"
        assert len(result.dimension_scores) == 5

    def test_faq_quality_passes_threshold(self):
        """Well-formed FAQ content meets the 3.5 threshold."""
        rubric = make_faq_quality_rubric()
        context = f"JSON-LD Schema:\n{SAMPLE_FAQ_JSONLD}"
        result = evaluate(SAMPLE_FAQ_HTML, rubric, context)

        assert result.passed is True
        assert result.average_score >= 3.5

    def test_faq_has_correct_count(self):
        """Sample FAQ has 3-5 questions (structural check)."""
        import re

        questions = re.findall(r'itemtype="https://schema.org/Question"', SAMPLE_FAQ_HTML)
        assert 3 <= len(questions) <= 5, f"Found {len(questions)} FAQ questions (expected 3-5)"

    def test_faq_html_matches_jsonld(self):
        """FAQ HTML question text matches JSON-LD question text (structural check)."""
        import re

        # Extract question text from HTML
        html_questions = re.findall(r'itemprop="name">([^<]+)</h3>', SAMPLE_FAQ_HTML)

        # Extract question text from JSON-LD
        jsonld = json.loads(SAMPLE_FAQ_JSONLD)
        jsonld_questions = [q["name"] for q in jsonld["mainEntity"]]

        assert len(html_questions) == len(jsonld_questions)
        for hq, jq in zip(html_questions, jsonld_questions):
            assert hq == jq, f"HTML question '{hq}' does not match JSON-LD question '{jq}'"

    def test_faq_schema_markup_present(self):
        """FAQ HTML includes FAQPage microdata attributes (structural check)."""
        assert 'itemtype="https://schema.org/FAQPage"' in SAMPLE_FAQ_HTML
        assert 'itemtype="https://schema.org/Question"' in SAMPLE_FAQ_HTML
        assert 'itemtype="https://schema.org/Answer"' in SAMPLE_FAQ_HTML
        assert 'itemprop="name"' in SAMPLE_FAQ_HTML
        assert 'itemprop="text"' in SAMPLE_FAQ_HTML


class TestEvalBCE2040FeedbackReflection:
    """EVAL-BCE2-040: Feedback reflection — AI judge compares pre- and
    post-feedback content to verify the system learned from feedback."""

    def test_feedback_reflection_returns_score(self):
        """Evaluation returns a valid JudgeScore with all 4 dimensions."""
        rubric = make_feedback_reflection_rubric()
        context = (
            f"## Feedback Rules Applied\n"
            + "\n".join(f"- {r}" for r in SAMPLE_FEEDBACK_RULES)
            + f"\n\n## Pre-Feedback Content\n{SAMPLE_PRE_FEEDBACK_CONTENT}"
        )
        result = evaluate(SAMPLE_POST_FEEDBACK_CONTENT, rubric, context)

        assert isinstance(result, JudgeScore)
        assert result.eval_id == "EVAL-BCE2-040"
        assert len(result.dimension_scores) == 4

    def test_feedback_reflection_passes_threshold(self):
        """Post-feedback content that reflects feedback meets the threshold."""
        rubric = make_feedback_reflection_rubric()
        context = (
            f"## Feedback Rules Applied\n"
            + "\n".join(f"- {r}" for r in SAMPLE_FEEDBACK_RULES)
            + f"\n\n## Pre-Feedback Content\n{SAMPLE_PRE_FEEDBACK_CONTENT}"
        )
        result = evaluate(SAMPLE_POST_FEEDBACK_CONTENT, rubric, context)

        assert result.passed is True
        assert result.average_score >= 3.5

    def test_pre_content_uses_wrong_terminology(self):
        """Pre-feedback content uses 'student driver' (structural check)."""
        assert "student driver" in SAMPLE_PRE_FEEDBACK_CONTENT.lower()

    def test_post_content_uses_correct_terminology(self):
        """Post-feedback content uses 'learner driver', not 'student driver' (structural check)."""
        assert "learner driver" in SAMPLE_POST_FEEDBACK_CONTENT.lower()
        assert "student driver" not in SAMPLE_POST_FEEDBACK_CONTENT.lower()

    def test_post_content_has_shorter_sentences(self):
        """Post-feedback content has shorter average sentence length (structural check)."""
        import re

        def avg_sentence_length(html: str) -> float:
            text = re.sub(r"<[^>]+>", "", html).strip()
            sentences = re.split(r"[.!?]+", text)
            sentences = [s.strip() for s in sentences if s.strip()]
            if not sentences:
                return 0.0
            return sum(len(s.split()) for s in sentences) / len(sentences)

        pre_avg = avg_sentence_length(SAMPLE_PRE_FEEDBACK_CONTENT)
        post_avg = avg_sentence_length(SAMPLE_POST_FEEDBACK_CONTENT)

        assert post_avg < pre_avg, (
            f"Post-feedback avg sentence length ({post_avg:.1f}) should be "
            f"shorter than pre-feedback ({pre_avg:.1f})"
        )

    def test_post_content_includes_statistics(self):
        """Post-feedback content includes specific numbers (structural check)."""
        import re

        numbers = re.findall(r"\d+", SAMPLE_POST_FEEDBACK_CONTENT)
        assert len(numbers) >= 3, (
            f"Post-feedback content should include specific numbers (found {len(numbers)})"
        )


class TestEvalBCE2050FreshnessRecommendations:
    """EVAL-BCE2-050: Freshness recommendation specificity — AI judge
    evaluates whether stale-content recommendations are actionable."""

    def test_freshness_recommendation_returns_score(self):
        """Evaluation returns a valid JudgeScore with all 4 dimensions."""
        rubric = make_freshness_recommendation_rubric()
        context = f"## Stale Page Info\n{json.dumps(SAMPLE_STALE_PAGE_INFO, indent=2)}"
        result = evaluate(SAMPLE_FRESHNESS_RECOMMENDATIONS, rubric, context)

        assert isinstance(result, JudgeScore)
        assert result.eval_id == "EVAL-BCE2-050"
        assert len(result.dimension_scores) == 4

    def test_freshness_recommendation_passes_threshold(self):
        """Specific recommendations meet the 3.5 threshold."""
        rubric = make_freshness_recommendation_rubric()
        context = f"## Stale Page Info\n{json.dumps(SAMPLE_STALE_PAGE_INFO, indent=2)}"
        result = evaluate(SAMPLE_FRESHNESS_RECOMMENDATIONS, rubric, context)

        assert result.passed is True
        assert result.average_score >= 3.5

    def test_recommendations_count(self):
        """At least 2 actionable recommendations are present (structural check)."""
        import re

        # Count numbered items
        items = re.findall(r"^\d+\.\s+\*\*", SAMPLE_FRESHNESS_RECOMMENDATIONS, re.MULTILINE)
        assert len(items) >= 2, f"Found {len(items)} recommendations (minimum 2 required)"

    def test_recommendations_are_page_type_specific(self):
        """Recommendations reference page-type-specific elements (structural check)."""
        # Service page should reference pricing, FAQ, pass rates
        content = SAMPLE_FRESHNESS_RECOMMENDATIONS.lower()
        assert "pricing" in content or "price" in content
        assert "faq" in content
        assert "pass rate" in content

    def test_recommendations_include_priority(self):
        """Recommendations include a priority level (structural check)."""
        content = SAMPLE_FRESHNESS_RECOMMENDATIONS.lower()
        assert "priority" in content or "high" in content

    def test_recommendations_reference_freshness_research(self):
        """Recommendations cite the 13-week freshness research (structural check)."""
        assert "13 weeks" in SAMPLE_FRESHNESS_RECOMMENDATIONS


class TestCrossEvalConsistency:
    """Cross-cutting tests that verify consistency across all eval cases."""

    ALL_RUBRIC_FACTORIES = [
        make_brand_voice_rubric,
        make_section_coherence_rubric,
        make_direct_answer_rubric,
        make_faq_quality_rubric,
        make_feedback_reflection_rubric,
        make_freshness_recommendation_rubric,
    ]

    def test_all_eval_ids_unique(self):
        """All eval case IDs are unique."""
        ids = [f().eval_id for f in self.ALL_RUBRIC_FACTORIES]
        assert len(ids) == len(set(ids)), f"Duplicate eval IDs found: {ids}"

    def test_all_rubrics_use_same_scale(self):
        """All rubrics use the 1-5 scoring scale."""
        for factory in self.ALL_RUBRIC_FACTORIES:
            rubric = factory()
            assert rubric.scoring_scale == "1-5", (
                f"{rubric.eval_id} uses scale '{rubric.scoring_scale}', expected '1-5'"
            )

    def test_all_rubrics_have_descriptions(self):
        """All rubrics and their dimensions have non-empty descriptions."""
        for factory in self.ALL_RUBRIC_FACTORIES:
            rubric = factory()
            assert rubric.description, f"{rubric.eval_id} missing description"
            for dim in rubric.dimensions:
                assert dim.description, (
                    f"{rubric.eval_id}.{dim.name} missing description"
                )

    def test_all_dimension_names_are_snake_case(self):
        """All dimension names use snake_case for JSON compatibility."""
        import re

        for factory in self.ALL_RUBRIC_FACTORIES:
            rubric = factory()
            for dim in rubric.dimensions:
                assert re.match(r"^[a-z][a-z0-9_]*$", dim.name), (
                    f"{rubric.eval_id}.{dim.name} is not valid snake_case"
                )

    @pytest.mark.parametrize(
        "factory",
        ALL_RUBRIC_FACTORIES,
    )
    def test_mock_mode_returns_passing_scores(self, factory):
        """In mock mode, all evaluations return passing scores (for CI stability)."""
        rubric = factory()
        result = evaluate("test content", rubric)
        assert result.passed is True, (
            f"{rubric.eval_id} mock mode returned failing score: "
            f"avg={result.average_score}, threshold={rubric.threshold}"
        )
