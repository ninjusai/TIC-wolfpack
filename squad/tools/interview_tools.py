#!/usr/bin/env python3
"""MCP tool implementations for the interview system.

These functions are designed to be called by Claude Agent SDK as MCP tools.
Each function returns a dict suitable for JSON serialization.
"""

import sqlite3
import os
import sys
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Database path relative to this file
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wolfpack.db")

# Artifacts path (project root)
ARTIFACTS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "artifacts")

# Solution language patterns to detect
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


def get_db():
    """Get database connection with foreign keys enabled."""
    if not os.path.exists(DB_PATH):
        raise RuntimeError(f"Database not found at {DB_PATH}. Run init_db.py first.")
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def now() -> str:
    """Return current UTC timestamp as ISO string."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def now_iso() -> str:
    """Return current UTC timestamp as full ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def contains_solution_language(text: str) -> bool:
    """Check if text contains solution language patterns."""
    text_lower = text.lower()
    for pattern in SOLUTION_LANGUAGE_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    return False


def save_interview_response(session_id: str, stage: str, field_name: str,
                           question: str, response: str, turn_number: int) -> dict:
    """Save an interview response to the database.

    This MCP tool persists interview progress after each user turn.

    Args:
        session_id: The interview session ID
        stage: Current interview stage (problem_discovery, user_identification,
               scope_definition, constraints, success_criteria, prior_art)
        field_name: The field being populated by this response
        question: The question that was asked
        response: The user's response text
        turn_number: The conversation turn number

    Returns:
        dict with:
            - success: bool
            - response_id: int (if successful)
            - error: str (if failed)
    """
    try:
        db = get_db()

        interview = db.execute(
            "SELECT id, turn_count FROM interviews WHERE session_id = ?",
            (session_id,)
        ).fetchone()

        if not interview:
            db.close()
            return {"success": False, "error": f"Interview not found: {session_id}"}

        cursor = db.execute(
            """INSERT INTO interview_responses
               (interview_id, stage, field_name, question, response, turn_number, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (interview["id"], stage, field_name, question, response, turn_number, now())
        )
        response_id = cursor.lastrowid

        # Update interview turn count and current stage
        new_turn_count = max(interview["turn_count"], turn_number)
        db.execute(
            """UPDATE interviews
               SET turn_count = ?, current_stage = ?, updated_at = ?
               WHERE id = ?""",
            (new_turn_count, stage, now(), interview["id"])
        )

        db.commit()
        db.close()

        return {
            "success": True,
            "response_id": response_id,
            "turn_number": turn_number,
            "stage": stage
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def complete_interview(session_id: str, project_slug: str,
                      project_title: str, intake_brief: dict) -> dict:
    """Mark interview complete and write Intake Brief JSON.

    This MCP tool finalizes an interview by:
    1. Validating the intake_brief against the schema
    2. Writing the brief to artifacts/{project_slug}/intake-brief.json
    3. Updating the interview status to 'complete'

    Args:
        session_id: The interview session ID
        project_slug: Kebab-case project identifier
        project_title: Human-readable project title
        intake_brief: The complete intake brief object following the schema

    Returns:
        dict with:
            - success: bool
            - file_path: str (if successful)
            - validation: dict (validation results)
            - error: str (if failed)
    """
    try:
        # First validate the intake brief
        validation = validate_intake_brief(intake_brief)

        if not validation["passed"]:
            return {
                "success": False,
                "error": "Intake brief validation failed",
                "validation": validation
            }

        db = get_db()

        interview = db.execute(
            "SELECT id, turn_count, started_at FROM interviews WHERE session_id = ?",
            (session_id,)
        ).fetchone()

        if not interview:
            db.close()
            return {"success": False, "error": f"Interview not found: {session_id}"}

        # Create project directory if it doesn't exist
        project_dir = os.path.join(ARTIFACTS_PATH, project_slug)
        Path(project_dir).mkdir(parents=True, exist_ok=True)

        # Prepare the full intake brief document
        completed_at = now_iso()
        full_brief = {
            "id": f"INT-{project_slug}-001",
            "project_slug": project_slug,
            "project_title": project_title,
            "version": "1.0.0",
            "status": "complete",
            "created_at": interview["started_at"].replace(" ", "T") + "Z" if interview["started_at"] else completed_at,
            "updated_at": completed_at,
            "interview": {
                "session_id": session_id,
                "started_at": interview["started_at"].replace(" ", "T") + "Z" if interview["started_at"] else None,
                "completed_at": completed_at,
                "turn_count": interview["turn_count"],
                "abandoned": False
            },
            "fields": intake_brief.get("fields", intake_brief),
            "validation": validation
        }

        # Ensure fields structure exists
        if "fields" not in full_brief or not isinstance(full_brief["fields"], dict):
            # If intake_brief was passed as the fields directly
            if all(k in intake_brief for k in ["problem_statement", "users"]):
                full_brief["fields"] = intake_brief

        # Write to file
        brief_path = os.path.join(project_dir, "intake-brief.json")
        with open(brief_path, "w", encoding="utf-8") as f:
            json.dump(full_brief, f, indent=2)

        # Update interview record
        db.execute(
            """UPDATE interviews
               SET status = 'complete',
                   completed_at = ?,
                   updated_at = ?,
                   intake_brief_path = ?,
                   project_slug = ?
               WHERE id = ?""",
            (now(), now(), brief_path, project_slug, interview["id"])
        )

        db.commit()
        db.close()

        return {
            "success": True,
            "file_path": brief_path,
            "validation": validation,
            "interview_id": f"INT-{project_slug}-001"
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_interview_progress(session_id: str) -> dict:
    """Get current interview progress for resume.

    This MCP tool retrieves the full interview state including all responses,
    enabling the Interviewer agent to resume from where it left off.

    Args:
        session_id: The interview session ID

    Returns:
        dict with:
            - success: bool
            - interview: dict (interview record)
            - responses: list (all responses ordered by turn)
            - current_stage: str
            - completed_stages: list (stages with responses)
            - turn_count: int
            - fields_collected: dict (aggregated field values)
            - error: str (if failed)
    """
    try:
        db = get_db()

        interview = db.execute(
            "SELECT * FROM interviews WHERE session_id = ?",
            (session_id,)
        ).fetchone()

        if not interview:
            db.close()
            return {"success": False, "error": f"Interview not found: {session_id}"}

        responses = db.execute(
            """SELECT * FROM interview_responses
               WHERE interview_id = ?
               ORDER BY turn_number""",
            (interview["id"],)
        ).fetchall()

        db.close()

        # Aggregate responses by stage and field
        stages_with_responses = set()
        fields_collected = {}

        for r in responses:
            stages_with_responses.add(r["stage"])
            field_key = f"{r['stage']}.{r['field_name']}"
            # Keep the most recent response for each field
            fields_collected[field_key] = r["response"]

        # Determine stage completion order
        stage_order = [
            "problem_discovery",
            "user_identification",
            "scope_definition",
            "constraints",
            "success_criteria",
            "prior_art"
        ]

        completed_stages = [s for s in stage_order if s in stages_with_responses]

        return {
            "success": True,
            "interview": dict(interview),
            "responses": [dict(r) for r in responses],
            "current_stage": interview["current_stage"],
            "completed_stages": completed_stages,
            "turn_count": interview["turn_count"],
            "fields_collected": fields_collected
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def validate_intake_brief(brief: dict) -> dict:
    """Run validation checks on intake brief.

    This implements the validation gate from the design doc.
    Checks ensure all required fields are present and meet quality criteria.

    Args:
        brief: The intake brief object (can be the full brief or just the fields)

    Returns:
        dict with:
            - passed: bool
            - checks: dict (individual check results)
            - gaps: list (names of failing checks)
    """
    # Handle both full brief format and fields-only format
    fields = brief.get("fields", brief)

    # Default check results
    checks = {
        "problem_no_solution_language": False,
        "has_user": False,
        "has_scope_in": False,
        "scope_out_addressed": False,
        "has_testable_criterion": False,
        "constraints_addressed": False
    }

    gaps = []

    # Check 1: Problem statement exists and contains no solution language
    problem_statement = fields.get("problem_statement", "")
    if problem_statement:
        if not contains_solution_language(problem_statement):
            checks["problem_no_solution_language"] = True
        else:
            gaps.append("problem_no_solution_language: Problem statement contains solution language")
    else:
        gaps.append("problem_no_solution_language: Problem statement is missing")

    # Check 2: At least one user defined
    users = fields.get("users", [])
    if isinstance(users, list) and len(users) >= 1:
        # Verify user has role and goal
        valid_users = [u for u in users if isinstance(u, dict) and u.get("role") and u.get("goal")]
        if valid_users:
            checks["has_user"] = True
        else:
            gaps.append("has_user: Users exist but none have both role and goal")
    else:
        gaps.append("has_user: No users defined")

    # Check 3: At least one in-scope item
    scope_in = fields.get("scope_in", [])
    if isinstance(scope_in, list) and len(scope_in) >= 1:
        # Filter out empty strings
        valid_scope_in = [s for s in scope_in if s and str(s).strip()]
        if valid_scope_in:
            checks["has_scope_in"] = True
        else:
            gaps.append("has_scope_in: scope_in has no valid items")
    else:
        gaps.append("has_scope_in: No scope_in items defined")

    # Check 4: scope_out is addressed (can be empty list but must exist and be explicitly set)
    scope_out = fields.get("scope_out")
    if scope_out is not None:
        # Empty list is valid if explicitly set
        checks["scope_out_addressed"] = True
    else:
        gaps.append("scope_out_addressed: scope_out is not addressed")

    # Check 5: At least one testable success criterion
    success_criteria = fields.get("success_criteria", [])
    if isinstance(success_criteria, list) and len(success_criteria) >= 1:
        testable_criteria = [c for c in success_criteria
                           if isinstance(c, dict) and c.get("testable") is True]
        if testable_criteria:
            checks["has_testable_criterion"] = True
        else:
            gaps.append("has_testable_criterion: No success criteria marked as testable")
    else:
        gaps.append("has_testable_criterion: No success criteria defined")

    # Check 6: constraints are addressed (can be empty but must be explicitly set)
    constraints = fields.get("constraints")
    if constraints is not None:
        checks["constraints_addressed"] = True
    else:
        gaps.append("constraints_addressed: constraints not addressed")

    return {
        "passed": all(checks.values()),
        "checks": checks,
        "gaps": gaps
    }


# MCP Tool Definitions for Claude Agent SDK
# These schemas describe the tools for the SDK

MCP_TOOL_DEFINITIONS = [
    {
        "name": "save_interview_response",
        "description": "Save an interview response to the database",
        "input_schema": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "Interview session ID"},
                "stage": {
                    "type": "string",
                    "enum": ["problem_discovery", "user_identification", "scope_definition",
                            "constraints", "success_criteria", "prior_art"],
                    "description": "Current interview stage"
                },
                "field_name": {"type": "string", "description": "Field being populated"},
                "question": {"type": "string", "description": "Question that was asked"},
                "response": {"type": "string", "description": "User's response"},
                "turn_number": {"type": "integer", "description": "Conversation turn number"}
            },
            "required": ["session_id", "stage", "field_name", "question", "response", "turn_number"]
        }
    },
    {
        "name": "complete_interview",
        "description": "Mark interview complete and generate Intake Brief",
        "input_schema": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "Interview session ID"},
                "project_slug": {"type": "string", "description": "Kebab-case project identifier"},
                "project_title": {"type": "string", "description": "Human-readable project title"},
                "intake_brief": {"type": "object", "description": "Complete intake brief fields"}
            },
            "required": ["session_id", "project_slug", "project_title", "intake_brief"]
        }
    },
    {
        "name": "get_interview_progress",
        "description": "Get current interview progress for resume",
        "input_schema": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "Interview session ID"}
            },
            "required": ["session_id"]
        }
    },
    {
        "name": "validate_intake_brief",
        "description": "Run validation checks on intake brief",
        "input_schema": {
            "type": "object",
            "properties": {
                "brief": {"type": "object", "description": "Intake brief to validate"}
            },
            "required": ["brief"]
        }
    }
]


if __name__ == "__main__":
    # Self-test: print tool definitions
    print("Interview Tools MCP Definitions:")
    print(json.dumps(MCP_TOOL_DEFINITIONS, indent=2))
