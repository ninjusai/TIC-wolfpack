---
id: EVL-interview-intake-001
title: Interview Intake System Eval Spec
version: 1.0.0
status: draft
author: eval
last-updated: 2026-04-01
traces-to:
  design: DES-interview-intake-001
---

# Interview Intake System Eval Spec

## 1. Overview

This document specifies the evaluation criteria and test cases for the Interview Intake System. The interview system conducts structured, multi-turn conversations with the Pack Owner to gather project requirements and produce validated Intake Brief JSON files.

### 1.1 Scope

This eval covers:
- Interview conversation quality (adaptive questioning, solution language detection, vague input recovery)
- Intake Brief output quality (completeness, field accuracy, schema conformance)
- Interview efficiency (turn count, duration)
- Session management (pause/resume, abandonment handling)
- Cost controls (max_turns, max_budget_usd enforcement)
- Downstream integration (Framer handoff)

### 1.2 Out of Scope

- Framer's internal processing of problem.md (covered by Framer eval)
- Database schema validation (covered by unit tests)
- MCP tool implementation correctness (covered by integration tests)

---

## 2. Eval Dimensions

The Interview Intake System is evaluated on three primary dimensions with associated metrics.

### 2.1 Completeness

All required fields must be populated with substantive content.

| Metric | Check | Pass | Warning | Fail |
|--------|-------|------|---------|------|
| COMP-001 | `problem_statement` present | Non-empty string | — | Missing or empty |
| COMP-002 | `users[]` has >= 1 entry | >= 1 user with role + goal | — | Empty or no valid users |
| COMP-003 | `scope_in[]` has >= 1 entry | >= 1 non-empty item | — | Empty array |
| COMP-004 | `scope_out[]` addressed | Explicit items OR confirmed "none" | — | Null/unaddressed |
| COMP-005 | `success_criteria[]` has >= 1 testable entry | >= 1 criterion with `testable: true` | — | No testable criteria |
| COMP-006 | `constraints[]` addressed | Explicit items OR confirmed "none" | — | Null/unaddressed |

**Scoring:**
- Pass: All 6 checks pass
- Warning: Not applicable (completeness is binary)
- Fail: Any check fails

### 2.2 Quality

Fields must contain high-quality, actionable content.

| Metric | Check | Pass | Warning | Fail |
|--------|-------|------|---------|------|
| QUAL-001 | Problem contains no solution language | Zero pattern matches | — | Any solution language detected |
| QUAL-002 | Users are concrete (not abstract) | All users have specific roles + goals | Some users vague | Only abstract "users" |
| QUAL-003 | Success criteria are testable | All criteria have measurement | Some criteria lack measurement | All criteria vague |
| QUAL-004 | Scope boundaries are clear | In/out clearly delineated | Minor ambiguity | Major overlap or confusion |

**Solution Language Patterns (from interview_tools.py):**
```
- "we should build"
- "we need to build"
- "we want to build"
- "let's build"
- "let's create"
- "we should create"
- "we need a system that"
- "I want a system that"
- "the solution is"
- "the solution should"
- "we need an app"
- "we need a tool"
- "we should implement"
- "we need to implement"
```

**Scoring:**
- Pass: All 4 checks pass
- Warning: QUAL-002 or QUAL-003 at warning level
- Fail: Any check fails

### 2.3 Efficiency

Interview must be completed in reasonable time and turns.

| Metric | Check | Pass | Warning | Fail |
|--------|-------|------|---------|------|
| EFFI-001 | Turn count | <= 15 turns | 16-25 turns | > 25 turns |
| EFFI-002 | Total duration | <= 20 minutes | 21-40 minutes | > 40 minutes |
| EFFI-003 | Abandonment rate (aggregate) | < 10% | 10-25% | > 25% |

**Scoring:**
- Pass: All metrics at pass level
- Warning: Any metric at warning level, none at fail
- Fail: Any metric at fail level

---

## 3. Datasets

### 3.1 Synthetic Interview Scenarios

For automated eval, we define synthetic user personas with scripted responses.

#### 3.1.1 Happy Path User (DATA-HP-001)

A cooperative user who provides clear, complete responses.

```json
{
  "persona_id": "DATA-HP-001",
  "name": "Happy Path User",
  "behavior": "cooperative",
  "responses": {
    "problem_discovery": "Our customer support team spends too much time answering repetitive questions. The average response time is 4 hours, and customers often abandon tickets before getting help.",
    "user_identification": "Two main users: (1) End customers who contact support via web chat, they need quick answers to product questions. (2) Support agents who handle complex escalations and need efficient handoff from automated systems.",
    "scope_definition": {
      "in": "Automated first-response for common questions, handoff to human agent when needed, integration with existing Zendesk system",
      "out": "Billing integration, phone support, multilingual support"
    },
    "constraints": "Must integrate with Zendesk API, response latency under 5 seconds, cannot store customer PII beyond session",
    "success_criteria": "First-response time under 30 seconds, customer satisfaction score >= 4.0/5.0, 50% of tickets resolved without human intervention",
    "prior_art": "Existing FAQ page at /help, previous rule-based chatbot attempt deprecated in 2025"
  }
}
```

#### 3.1.2 Solution-Language User (DATA-SL-001)

A user who speaks in solutions rather than problems.

```json
{
  "persona_id": "DATA-SL-001",
  "name": "Solution Language User",
  "behavior": "solution_focused",
  "responses": {
    "problem_discovery": [
      {"turn": 1, "response": "We need to build a chatbot for customer support."},
      {"turn": 2, "response": "Customers wait too long for answers. The support team is overwhelmed."}
    ]
  },
  "expected_behavior": "Interviewer should detect solution language in turn 1 and probe for underlying problem"
}
```

#### 3.1.3 Vague User (DATA-VG-001)

A user who provides abstract, non-specific responses.

```json
{
  "persona_id": "DATA-VG-001",
  "name": "Vague User",
  "behavior": "vague",
  "responses": {
    "user_identification": [
      {"turn": 1, "response": "Users want better support."},
      {"turn": 2, "response": "Our customers, I guess. They contact us when they have problems."},
      {"turn": 3, "response": "Specifically, it's small business owners who use our SaaS product. They need help with onboarding and billing questions during their trial period."}
    ]
  },
  "expected_behavior": "Interviewer should probe for specificity until concrete user role and goal are identified"
}
```

#### 3.1.4 Abandoning User (DATA-AB-001)

A user who leaves mid-interview.

```json
{
  "persona_id": "DATA-AB-001",
  "name": "Abandoning User",
  "behavior": "abandon",
  "responses": {
    "problem_discovery": "We have too many manual processes in our deployment pipeline.",
    "user_identification": null
  },
  "abandon_point": "After problem_discovery stage",
  "abandon_type": "timeout"
}
```

### 3.2 Golden Intake Briefs

Reference outputs for comparison scoring.

| Golden ID | Description | Source |
|-----------|-------------|--------|
| GOLD-001 | Customer support chatbot | DESIGN.md Section 3.2 example |
| GOLD-002 | Deployment automation tool | Synthetic from DATA-HP-001 variant |
| GOLD-003 | Interview system itself | Self-referential test |

### 3.3 Edge Case Inputs

| Case ID | Input Type | Description |
|---------|------------|-------------|
| EDGE-001 | Empty responses | User provides "" for all questions |
| EDGE-002 | Single-word responses | User provides only "yes", "no", "fine" |
| EDGE-003 | Very long responses | User provides 2000+ character responses |
| EDGE-004 | Non-English characters | User includes Unicode, emojis |
| EDGE-005 | JSON injection | User includes JSON syntax in responses |

---

## 4. Scorers

### 4.1 Algorithmic Scorers

These scorers are deterministic and can be automated.

#### 4.1.1 Schema Conformance Scorer (SCORE-SCHEMA)

Validates Intake Brief against JSON Schema from DESIGN.md Section 3.1.

```python
def score_schema_conformance(intake_brief: dict) -> dict:
    """Validate against Intake Brief JSON Schema."""
    from jsonschema import validate, ValidationError

    try:
        validate(instance=intake_brief, schema=INTAKE_BRIEF_SCHEMA)
        return {"passed": True, "errors": []}
    except ValidationError as e:
        return {"passed": False, "errors": [str(e)]}
```

#### 4.1.2 Completeness Scorer (SCORE-COMPLETE)

Uses `validate_intake_brief()` from `interview_tools.py`.

```python
def score_completeness(intake_brief: dict) -> dict:
    """Score completeness using existing validation."""
    from squad.tools.interview_tools import validate_intake_brief
    return validate_intake_brief(intake_brief)
```

#### 4.1.3 Solution Language Scorer (SCORE-SOLUTION)

Uses `contains_solution_language()` from `interview_tools.py`.

```python
def score_solution_language(problem_statement: str) -> dict:
    """Check for solution language in problem statement."""
    from squad.tools.interview_tools import contains_solution_language

    has_solution = contains_solution_language(problem_statement)
    return {
        "passed": not has_solution,
        "has_solution_language": has_solution
    }
```

#### 4.1.4 Efficiency Scorer (SCORE-EFFICIENCY)

Evaluates turn count and duration against thresholds.

```python
def score_efficiency(turn_count: int, duration_minutes: float) -> dict:
    """Score interview efficiency."""
    turn_score = "pass" if turn_count <= 15 else ("warn" if turn_count <= 25 else "fail")
    duration_score = "pass" if duration_minutes <= 20 else ("warn" if duration_minutes <= 40 else "fail")

    overall = "fail" if "fail" in [turn_score, duration_score] else (
        "warn" if "warn" in [turn_score, duration_score] else "pass"
    )

    return {
        "turn_count": turn_count,
        "turn_score": turn_score,
        "duration_minutes": duration_minutes,
        "duration_score": duration_score,
        "overall": overall
    }
```

### 4.2 LLM-Assisted Scorers

These scorers use an LLM to evaluate subjective quality.

#### 4.2.1 User Concreteness Scorer (SCORE-USERS)

Evaluates whether users are specific or abstract.

```
Prompt: Evaluate whether this user description is concrete or abstract.

A concrete user has:
- Specific role (not just "users" or "customers")
- Clear goal (what they are trying to accomplish)
- Context (when/where they interact)

User: {user_json}

Rate as: CONCRETE (specific role + goal), PARTIAL (some specificity), ABSTRACT (generic reference)
```

#### 4.2.2 Testability Scorer (SCORE-TESTABLE)

Evaluates whether success criteria are actually testable.

```
Prompt: Evaluate whether this success criterion is testable.

A testable criterion:
- Has a measurable outcome
- Can be verified objectively
- Has a clear pass/fail condition

Criterion: {criterion_text}
Measurement: {measurement_text}

Rate as: TESTABLE (can write an automated test), PARTIAL (needs clarification), VAGUE (not testable)
```

#### 4.2.3 Adaptive Questioning Scorer (SCORE-ADAPTIVE)

Evaluates whether the interviewer correctly adapted to user responses.

```
Prompt: Review this interview transcript segment.

User said: "{user_response}"
Interviewer then asked: "{interviewer_question}"

Expected behavior: {expected_behavior}

Did the interviewer correctly adapt?
- YES: Appropriate follow-up for the input type
- PARTIAL: Some adaptation but missed key issues
- NO: Did not adapt appropriately
```

---

## 5. Eval Cases

### 5.1 EVL-INT-001: Complete Happy-Path Interview

| Field | Value |
|-------|-------|
| **Case ID** | EVL-INT-001 |
| **Title** | Complete Happy-Path Interview |
| **Objective** | Verify that a cooperative user can complete a full interview with valid output |
| **Dataset** | DATA-HP-001 (Happy Path User) |
| **Preconditions** | Fresh interview session, no prior data |

**Test Steps:**
1. Start new interview session
2. Provide cooperative responses for each stage:
   - Problem Discovery: Clear problem statement without solution language
   - User Identification: Specific users with roles and goals
   - Scope Definition: Clear in-scope and out-of-scope items
   - Constraints: Explicit constraints or confirmed "none"
   - Success Criteria: Measurable, testable criteria
   - Prior Art: Optional content or "none"
3. Interview completes and generates Intake Brief

**Pass Conditions:**
- [ ] All fields populated in Intake Brief
- [ ] `validation.passed == true`
- [ ] `interview.turn_count <= 15`
- [ ] Schema validation passes (SCORE-SCHEMA)
- [ ] Completeness check passes (SCORE-COMPLETE)
- [ ] No solution language in problem statement (SCORE-SOLUTION)

**Measurements:**
- Turn count
- Duration (minutes)
- Field quality scores

---

### 5.2 EVL-INT-002: Solution Language Detection

| Field | Value |
|-------|-------|
| **Case ID** | EVL-INT-002 |
| **Title** | Solution Language Detection |
| **Objective** | Verify that the interviewer detects and redirects solution-focused responses |
| **Dataset** | DATA-SL-001 (Solution Language User) |
| **Preconditions** | Fresh interview session |

**Test Steps:**
1. Start interview
2. In Problem Discovery, respond: "We should build a chatbot for customer support."
3. Observe interviewer response
4. If redirected, provide problem-focused response
5. Complete interview

**Pass Conditions:**
- [ ] Interviewer does NOT accept solution language as problem statement
- [ ] Interviewer asks follow-up question probing for underlying problem
- [ ] Follow-up matches pattern: "What problem would that solve?" or equivalent
- [ ] Final `problem_statement` contains no solution language
- [ ] SCORE-SOLUTION passes on final output

**Example Expected Interaction:**
```
User: "We should build a chatbot for customer support."
Interviewer: "That sounds like a solution. What problem would that solve?
             What's painful today without it?"
User: "Customers wait too long for answers..."
Interviewer: [accepts as problem statement]
```

---

### 5.3 EVL-INT-003: Vague User Recovery

| Field | Value |
|-------|-------|
| **Case ID** | EVL-INT-003 |
| **Title** | Vague User Recovery |
| **Objective** | Verify that the interviewer probes for specificity when users are vague |
| **Dataset** | DATA-VG-001 (Vague User) |
| **Preconditions** | Interview has passed Problem Discovery |

**Test Steps:**
1. Start interview and complete Problem Discovery
2. In User Identification, respond: "Users want better support."
3. Observe interviewer response
4. Provide slightly more specific but still vague response
5. Observe second follow-up
6. Provide concrete user description
7. Proceed with interview

**Pass Conditions:**
- [ ] Interviewer does NOT accept "users" as valid user entry
- [ ] Interviewer asks for specific role (first follow-up)
- [ ] Interviewer continues probing until concrete user obtained (max 3 questions per stage)
- [ ] Final `users[]` contains at least one entry with specific `role` and `goal`
- [ ] SCORE-USERS rates final users as CONCRETE

**Example Expected Interaction:**
```
User: "Users want better support."
Interviewer: "Let's get specific. Can you name one concrete role — like
             'senior developer on the platform team' — and what they need to do?"
User: "Our customers, I guess."
Interviewer: "What type of customers? What are they trying to accomplish
             when they need support?"
User: "Small business owners using our SaaS product. They need help with
       onboarding and billing questions."
Interviewer: [accepts and moves to next stage]
```

---

### 5.4 EVL-INT-004: Session Pause/Resume

| Field | Value |
|-------|-------|
| **Case ID** | EVL-INT-004 |
| **Title** | Session Pause/Resume |
| **Objective** | Verify that interviews can be paused and resumed from the correct state |
| **Dataset** | DATA-HP-001 (partial) |
| **Preconditions** | Fresh interview session |

**Test Steps:**
1. Start interview
2. Complete Problem Discovery and User Identification stages
3. Begin Scope Definition (provide one response)
4. Simulate user departure (5+ minute inactivity)
5. Verify session marked as `paused` in database
6. Resume session
7. Verify interviewer summarizes progress
8. Continue from Scope Definition (not from beginning)
9. Complete interview

**Pass Conditions:**
- [ ] Session status changes to `paused` after inactivity
- [ ] `get_interview_progress()` returns correct state:
  - `current_stage == "scope_definition"`
  - `completed_stages == ["problem_discovery", "user_identification"]`
  - All previous responses preserved
- [ ] Resume message includes summary of completed stages
- [ ] Interview continues from Scope Definition, not Problem Discovery
- [ ] No duplicate questions for already-answered stages
- [ ] Final Intake Brief is complete and valid

**Database State Checks:**
```sql
-- After pause
SELECT status, current_stage, turn_count FROM interviews WHERE session_id = ?;
-- Expected: status='paused', current_stage='scope_definition', turn_count=N

-- Responses preserved
SELECT COUNT(*) FROM interview_responses WHERE interview_id = ?;
-- Expected: All responses from turns 1-N present
```

---

### 5.5 EVL-INT-005: Abandonment Handling

| Field | Value |
|-------|-------|
| **Case ID** | EVL-INT-005 |
| **Title** | Abandonment Handling |
| **Objective** | Verify that abandoned interviews are marked correctly with no orphan data |
| **Dataset** | DATA-AB-001 (Abandoning User) |
| **Preconditions** | Fresh interview session |

**Test Steps:**
1. Start interview
2. Complete Problem Discovery
3. User does not respond (simulate 7-day timeout) OR user says "cancel"
4. Verify abandonment processing

**Pass Conditions:**
- [ ] Interview status changes to `abandoned`
- [ ] `abandon_reason` is set ("timeout_7_days" or "user_cancelled")
- [ ] No Intake Brief file is created at `artifacts/{project-slug}/intake-brief.json`
- [ ] Interview responses are retained for audit (30-day retention)
- [ ] Project slug is freed for new interview
- [ ] No orphan records in `interview_responses` without parent interview

**Abandonment Types to Test:**

| Trigger | Expected `abandon_reason` |
|---------|--------------------------|
| 7-day timeout | `timeout_7_days` |
| User says "cancel" | `user_cancelled` |
| User says "never mind" | `user_cancelled` |
| New interview for same project | `superseded` |

**Database State Checks:**
```sql
-- After abandonment
SELECT status, abandon_reason, intake_brief_path FROM interviews WHERE session_id = ?;
-- Expected: status='abandoned', abandon_reason='timeout_7_days', intake_brief_path=NULL

-- No orphan responses
SELECT COUNT(*) FROM interview_responses WHERE interview_id NOT IN (SELECT id FROM interviews);
-- Expected: 0
```

---

### 5.6 EVL-INT-006: Cost Limit Enforcement

| Field | Value |
|-------|-------|
| **Case ID** | EVL-INT-006 |
| **Title** | Cost Limit Enforcement |
| **Objective** | Verify that interviews stop when cost limits are reached |
| **Dataset** | Synthetic long-running interview |
| **Preconditions** | Low cost limits configured |

**Test Configurations:**

| Config | `max_turns` | `max_budget_usd` |
|--------|-------------|------------------|
| Turn limit test | 5 | 10.00 |
| Budget limit test | 100 | 0.05 |

**Test Steps (Turn Limit):**
1. Configure `max_turns = 5`
2. Start interview
3. Provide responses requiring follow-up at each stage
4. Verify interview stops at turn 5
5. Verify graceful termination with partial state preserved

**Test Steps (Budget Limit):**
1. Configure `max_budget_usd = 0.05`
2. Start interview
3. Continue until budget exhausted
4. Verify interview stops when limit reached
5. Verify graceful termination

**Pass Conditions:**
- [ ] Interview stops at or before `max_turns` limit
- [ ] Interview stops at or before `max_budget_usd` limit
- [ ] Partial interview state is preserved (not lost)
- [ ] User receives clear message about limit reached
- [ ] No API errors or crashes when limit hit
- [ ] Session can be resumed if limits are increased

**Measurements:**
- Actual turn count at termination
- Actual cost at termination
- Error message clarity

---

### 5.7 EVL-INT-007: Intake Brief Schema Conformance

| Field | Value |
|-------|-------|
| **Case ID** | EVL-INT-007 |
| **Title** | Intake Brief Schema Conformance |
| **Objective** | Verify that all generated Intake Briefs conform to the JSON schema |
| **Dataset** | Multiple completed interviews |
| **Preconditions** | At least 3 completed interviews |

**Test Steps:**
1. Generate Intake Briefs from multiple interview scenarios
2. For each Intake Brief:
   - Load the JSON file
   - Validate against schema from DESIGN.md Section 3.1
   - Check all required fields
   - Verify field types and constraints

**Schema Requirements to Verify:**

| Field | Type | Constraint |
|-------|------|------------|
| `id` | string | Pattern: `^INT-[a-z0-9-]+-[0-9]{3}$` |
| `project_slug` | string | Pattern: `^[a-z0-9-]+$`, maxLength: 30 |
| `version` | string | Pattern: `^[0-9]+\.[0-9]+\.[0-9]+$` |
| `status` | string | Enum: draft, complete, approved, superseded |
| `interview.session_id` | string | Non-empty |
| `interview.turn_count` | integer | >= 0 |
| `fields.problem_statement` | string | minLength: 1 |
| `fields.users` | array | minItems: 1 |
| `fields.users[].role` | string | Required |
| `fields.users[].goal` | string | Required |
| `fields.scope_in` | array | minItems: 1 |
| `fields.success_criteria` | array | minItems: 1 |
| `fields.success_criteria[].testable` | boolean | Required |
| `validation.passed` | boolean | Required |
| `validation.checks` | object | Required |

**Pass Conditions:**
- [ ] All generated Intake Briefs pass JSON Schema validation
- [ ] No extra fields outside schema definition
- [ ] All timestamps are valid ISO 8601 format
- [ ] All IDs follow their specified patterns
- [ ] Nested objects (users, success_criteria) are properly structured

---

### 5.8 EVL-INT-008: Framer Handoff

| Field | Value |
|-------|-------|
| **Case ID** | EVL-INT-008 |
| **Title** | Framer Handoff |
| **Objective** | Verify that Framer can successfully produce `problem.md` from Intake Brief |
| **Dataset** | GOLD-001 (Customer support chatbot) |
| **Preconditions** | Valid Intake Brief at `artifacts/{project-slug}/intake-brief.json` |

**Test Steps:**
1. Generate Intake Brief from happy-path interview
2. Spawn Framer agent with:
   - Input: `artifacts/{project-slug}/intake-brief.json`
   - Output: `artifacts/{project-slug}/problem.md`
3. Verify Framer completes without error
4. Validate generated `problem.md`

**Pass Conditions:**
- [ ] Framer successfully reads Intake Brief
- [ ] Framer produces `problem.md` file
- [ ] `problem.md` contains required sections:
  - Section 1: Problem Statement (from `fields.problem_statement`)
  - Section 2: Scope (from `fields.scope_in`, `fields.scope_out`)
  - Section 3: Users (from `fields.users`)
  - Section 4: Success Criteria (from `fields.success_criteria`)
  - Section 5: Constraints (from `fields.constraints`)
- [ ] `problem.md` has valid YAML frontmatter with `PRB-{project}-001` ID
- [ ] Field mapping is accurate (spot check)
- [ ] No data loss in transformation

**Field Mapping Verification:**

| Intake Brief Field | Expected in problem.md |
|--------------------|------------------------|
| `fields.problem_statement` | Section 1 content |
| `fields.users[0].role` | Section 3, first user role |
| `fields.scope_in[0]` | Section 2, In Scope list |
| `fields.success_criteria[0].criterion` | Section 4, first criterion |
| `validation.gaps[]` | Section 7: Open Questions (if any) |

---

## 6. Thresholds

### 6.1 Per-Dimension Thresholds

#### Completeness (Binary)

| Outcome | Criteria |
|---------|----------|
| **PASS** | All 6 completeness checks pass |
| **FAIL** | Any completeness check fails |

#### Quality

| Outcome | Criteria |
|---------|----------|
| **PASS** | All 4 quality checks pass |
| **WARN** | QUAL-002 or QUAL-003 at warning level |
| **FAIL** | QUAL-001 or QUAL-004 fails, or any check at fail level |

#### Efficiency

| Outcome | Turn Count | Duration |
|---------|------------|----------|
| **PASS** | <= 15 | <= 20 min |
| **WARN** | 16-25 | 21-40 min |
| **FAIL** | > 25 | > 40 min |

### 6.2 Overall Interview Score

An interview receives an overall score based on the three dimensions:

| Overall | Completeness | Quality | Efficiency |
|---------|--------------|---------|------------|
| **PASS** | PASS | PASS | PASS |
| **PASS** | PASS | PASS | WARN |
| **PASS** | PASS | WARN | PASS |
| **WARN** | PASS | WARN | WARN |
| **WARN** | PASS | PASS | WARN (with efficiency warning) |
| **FAIL** | FAIL | any | any |
| **FAIL** | any | FAIL | any |
| **FAIL** | any | any | FAIL |

### 6.3 Aggregate Thresholds (System Health)

For monitoring the interview system across multiple sessions:

| Metric | Healthy | Degraded | Critical |
|--------|---------|----------|----------|
| Interview pass rate | >= 90% | 75-89% | < 75% |
| Avg turn count | <= 12 | 13-18 | > 18 |
| Avg duration | <= 15 min | 16-25 min | > 25 min |
| Abandonment rate | < 10% | 10-25% | > 25% |
| Schema errors | 0% | 1-5% | > 5% |

---

## 7. Implementation Notes

### 7.1 Eval Harness Location

Eval tests should be implemented in:
- `tests/test_interview_eval.py` — Pytest-based eval harness
- `tests/fixtures/interview_scenarios.json` — Test scenario data

### 7.2 Running Evals

```bash
# Run all interview evals
pytest tests/test_interview_eval.py -v

# Run specific eval case
pytest tests/test_interview_eval.py -v -k "EVL_INT_001"

# Run with scoring report
pytest tests/test_interview_eval.py -v --report=eval_report.json

# Run aggregate health check
python squad/evals/interview_health.py --output=health_report.json
```

### 7.3 Mock Interview Execution

For automated testing, use a mock interview runner:

```python
from squad.evals.interview_mock import MockInterviewRunner

runner = MockInterviewRunner(persona=DATA_HP_001)
result = runner.run_interview()

assert result.turn_count <= 15
assert result.validation.passed == True
```

### 7.4 LLM Scorer Configuration

For LLM-assisted scorers, use the following model configuration:

```python
SCORER_CONFIG = {
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "temperature": 0.0  # Deterministic scoring
}
```

### 7.5 CI Integration

Add to CI pipeline (GitHub Actions):

```yaml
interview-evals:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Run interview evals
      run: |
        pytest tests/test_interview_eval.py -v --junitxml=eval-results.xml
    - name: Upload eval results
      uses: actions/upload-artifact@v4
      with:
        name: interview-eval-results
        path: eval-results.xml
```

### 7.6 Dependencies

Required packages for eval execution:

```
pytest>=7.0.0
jsonschema>=4.0.0
anthropic>=0.30.0  # For LLM-assisted scorers
```

---

## 8. Appendix

### 8.1 Intake Brief JSON Schema

See DESIGN.md Section 3.1 for the complete JSON Schema definition.

### 8.2 Solution Language Pattern Reference

From `squad/tools/interview_tools.py`:

```python
SOLUTION_LANGUAGE_PATTERNS = [
    r"\bwe should build\b",
    r"\bwe need to build\b",
    r"\bwe want to build\b",
    r"\blet's build\b",
    r"\blet's create\b",
    r"\bwe should create\b",
    r"\bwe need a system that\b",
    r"\bI want a system that\b",
    r"\bthe solution is\b",
    r"\bthe solution should\b",
    r"\bwe need an app\b",
    r"\bwe need a tool\b",
    r"\bwe should implement\b",
    r"\bwe need to implement\b",
]
```

### 8.3 Interview Stage Sequence

```
1. problem_discovery
2. user_identification
3. scope_definition
4. constraints
5. success_criteria
6. prior_art (optional)
```

### 8.4 Traceability Matrix

| Eval Case | Design Section | Implementation |
|-----------|----------------|----------------|
| EVL-INT-001 | 6.3 | test_complete_happy_path |
| EVL-INT-002 | 2.2 Stage 1, 6.3 | test_solution_language_detection |
| EVL-INT-003 | 2.2 Stage 2, 6.3 | test_vague_user_recovery |
| EVL-INT-004 | 5.3, 6.3 | test_session_pause_resume |
| EVL-INT-005 | 5.4, 6.3 | test_abandonment_handling |
| EVL-INT-006 | 5.5, 6.3 | test_cost_limit_enforcement |
| EVL-INT-007 | 3.1, 6.3 | test_schema_conformance |
| EVL-INT-008 | 3.3, 6.3 | test_framer_handoff |
