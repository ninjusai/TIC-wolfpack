#!/usr/bin/env python3
"""Wolf Pack Interview CLI. Manages interview sessions for project intake."""

import argparse
import sqlite3
import os
import sys
import json
import uuid
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wolfpack.db")


def get_db():
    """Get database connection with foreign keys enabled."""
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}. Run init_db.py first.", file=sys.stderr)
        sys.exit(1)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def now():
    """Return current UTC timestamp as ISO string."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def generate_session_id():
    """Generate a unique session ID."""
    return f"sess_{uuid.uuid4().hex[:12]}"


def start_interview(project_slug: str, title: str) -> dict:
    """Create a new interview session.

    Args:
        project_slug: Kebab-case project identifier
        title: Human-readable project title

    Returns:
        dict with session_id and interview info
    """
    db = get_db()
    session_id = generate_session_id()

    try:
        db.execute(
            """INSERT INTO interviews (session_id, project_slug, status, started_at, updated_at)
               VALUES (?, ?, 'in_progress', ?, ?)""",
            (session_id, project_slug, now(), now())
        )
        db.commit()

        result = {
            "success": True,
            "session_id": session_id,
            "project_slug": project_slug,
            "project_title": title,
            "status": "in_progress",
            "current_stage": "problem_discovery"
        }
    except sqlite3.IntegrityError as e:
        result = {"success": False, "error": str(e)}
    finally:
        db.close()

    return result


def resume_interview(session_id: str) -> dict:
    """Resume a paused or in-progress interview.

    Args:
        session_id: The session ID to resume

    Returns:
        dict with interview state and all responses
    """
    db = get_db()

    interview = db.execute(
        "SELECT * FROM interviews WHERE session_id = ?",
        (session_id,)
    ).fetchone()

    if not interview:
        db.close()
        return {"success": False, "error": f"Interview not found: {session_id}"}

    if interview["status"] in ("complete", "abandoned"):
        db.close()
        return {"success": False, "error": f"Interview is {interview['status']} and cannot be resumed"}

    responses = db.execute(
        """SELECT * FROM interview_responses
           WHERE interview_id = ?
           ORDER BY turn_number""",
        (interview["id"],)
    ).fetchall()

    # Update status to in_progress if paused
    if interview["status"] == "paused":
        db.execute(
            "UPDATE interviews SET status = 'in_progress', updated_at = ? WHERE id = ?",
            (now(), interview["id"])
        )
        db.commit()

    db.close()

    # Determine completed stages from responses
    stages_with_responses = set(r["stage"] for r in responses)

    return {
        "success": True,
        "interview": dict(interview),
        "responses": [dict(r) for r in responses],
        "current_stage": interview["current_stage"],
        "completed_stages": list(stages_with_responses),
        "turn_count": interview["turn_count"]
    }


def list_interviews(status: str = None, pending_handoff: bool = False) -> list:
    """List interviews with optional filters.

    Args:
        status: Filter by status (in_progress, paused, complete, abandoned)
        pending_handoff: If True, return only complete interviews not yet handed off

    Returns:
        List of interview records
    """
    db = get_db()

    if pending_handoff:
        # Complete interviews without a corresponding Framer task
        query = """
            SELECT i.* FROM interviews i
            WHERE i.status = 'complete'
            AND i.project_slug NOT IN (
                SELECT DISTINCT t.context FROM tasks t
                WHERE t.title LIKE 'Problem framing:%'
                AND t.context IS NOT NULL
            )
            ORDER BY i.completed_at DESC
        """
        rows = db.execute(query).fetchall()
    elif status:
        rows = db.execute(
            "SELECT * FROM interviews WHERE status = ? ORDER BY updated_at DESC",
            (status,)
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM interviews ORDER BY updated_at DESC LIMIT 50"
        ).fetchall()

    db.close()
    return [dict(r) for r in rows]


def get_interview_status(session_id: str) -> dict:
    """Get detailed status for an interview.

    Args:
        session_id: The session ID to query

    Returns:
        dict with interview details and response count per stage
    """
    db = get_db()

    interview = db.execute(
        "SELECT * FROM interviews WHERE session_id = ?",
        (session_id,)
    ).fetchone()

    if not interview:
        db.close()
        return {"success": False, "error": f"Interview not found: {session_id}"}

    # Count responses per stage
    stage_counts = db.execute(
        """SELECT stage, COUNT(*) as count
           FROM interview_responses
           WHERE interview_id = ?
           GROUP BY stage""",
        (interview["id"],)
    ).fetchall()

    db.close()

    return {
        "success": True,
        "interview": dict(interview),
        "responses_by_stage": {r["stage"]: r["count"] for r in stage_counts}
    }


def abandon_interview(session_id: str, reason: str) -> dict:
    """Mark an interview as abandoned.

    Args:
        session_id: The session ID to abandon
        reason: Reason for abandonment

    Returns:
        dict with success status
    """
    db = get_db()

    result = db.execute(
        """UPDATE interviews
           SET status = 'abandoned',
               abandoned = 1,
               abandon_reason = ?,
               updated_at = ?
           WHERE session_id = ? AND status IN ('in_progress', 'paused')""",
        (reason, now(), session_id)
    )

    if result.rowcount == 0:
        db.close()
        return {"success": False, "error": f"Interview not found or already terminated: {session_id}"}

    db.commit()
    db.close()

    return {"success": True, "session_id": session_id, "status": "abandoned", "reason": reason}


def update_interview(session_id: str, status: str = None, stage: str = None,
                     turn_count: int = None, intake_brief_path: str = None) -> dict:
    """Update interview fields.

    Args:
        session_id: The session ID to update
        status: New status value
        stage: New current_stage value
        turn_count: New turn_count value
        intake_brief_path: Path to generated intake brief

    Returns:
        dict with success status
    """
    db = get_db()

    updates = ["updated_at = ?"]
    params = [now()]

    if status:
        updates.append("status = ?")
        params.append(status)
        if status == "complete":
            updates.append("completed_at = ?")
            params.append(now())

    if stage:
        updates.append("current_stage = ?")
        params.append(stage)

    if turn_count is not None:
        updates.append("turn_count = ?")
        params.append(turn_count)

    if intake_brief_path:
        updates.append("intake_brief_path = ?")
        params.append(intake_brief_path)

    params.append(session_id)

    result = db.execute(
        f"UPDATE interviews SET {', '.join(updates)} WHERE session_id = ?",
        params
    )

    if result.rowcount == 0:
        db.close()
        return {"success": False, "error": f"Interview not found: {session_id}"}

    db.commit()
    db.close()

    return {"success": True, "session_id": session_id}


def save_response(session_id: str, stage: str, field_name: str,
                  question: str, response: str, turn_number: int) -> dict:
    """Save an interview response.

    Args:
        session_id: The session ID
        stage: Interview stage
        field_name: Field being populated
        question: The question asked
        response: User's response
        turn_number: Conversation turn number

    Returns:
        dict with success status
    """
    db = get_db()

    interview = db.execute(
        "SELECT id, turn_count FROM interviews WHERE session_id = ?",
        (session_id,)
    ).fetchone()

    if not interview:
        db.close()
        return {"success": False, "error": f"Interview not found: {session_id}"}

    db.execute(
        """INSERT INTO interview_responses
           (interview_id, stage, field_name, question, response, turn_number, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (interview["id"], stage, field_name, question, response, turn_number, now())
    )

    # Update interview turn count and stage
    new_turn_count = max(interview["turn_count"], turn_number)
    db.execute(
        """UPDATE interviews
           SET turn_count = ?, current_stage = ?, updated_at = ?
           WHERE id = ?""",
        (new_turn_count, stage, now(), interview["id"])
    )

    db.commit()
    db.close()

    return {"success": True, "response_saved": True, "turn_number": turn_number}


# CLI command handlers

def cmd_start(args):
    """Handle start action."""
    result = start_interview(args.project_slug, args.title)
    if result["success"]:
        print(f"Interview started: {result['session_id']}")
        print(f"  Project: {result['project_slug']}")
        print(f"  Stage: {result['current_stage']}")
    else:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)


def cmd_resume(args):
    """Handle resume action."""
    result = resume_interview(args.session_id)
    if result["success"]:
        print(f"Interview resumed: {args.session_id}")
        print(f"  Project: {result['interview']['project_slug']}")
        print(f"  Stage: {result['current_stage']}")
        print(f"  Turns: {result['turn_count']}")
        print(f"  Completed stages: {', '.join(result['completed_stages']) or 'none'}")
    else:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)


def cmd_list(args):
    """Handle list action."""
    rows = list_interviews(status=args.status, pending_handoff=args.pending_handoff)
    if not rows:
        print("No interviews found.")
        return

    for r in rows:
        abandoned = " [ABANDONED]" if r.get("abandoned") else ""
        print(f"  [{r['status']:^12}] {r['session_id']} - {r['project_slug'] or '(no slug)'}{abandoned}")
        print(f"               Stage: {r['current_stage']}, Turns: {r['turn_count']}")


def cmd_status(args):
    """Handle status action."""
    result = get_interview_status(args.session_id)
    if result["success"]:
        i = result["interview"]
        print(f"Interview: {i['session_id']}")
        print(f"  Project: {i['project_slug']}")
        print(f"  Status: {i['status']}")
        print(f"  Stage: {i['current_stage']}")
        print(f"  Turns: {i['turn_count']}")
        print(f"  Started: {i['started_at']}")
        print(f"  Updated: {i['updated_at']}")
        if i['completed_at']:
            print(f"  Completed: {i['completed_at']}")
        if i['abandoned']:
            print(f"  Abandoned: Yes - {i['abandon_reason']}")
        if i['intake_brief_path']:
            print(f"  Intake Brief: {i['intake_brief_path']}")

        stages = result["responses_by_stage"]
        if stages:
            print("  Responses by stage:")
            for stage, count in stages.items():
                print(f"    - {stage}: {count}")
    else:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)


def cmd_abandon(args):
    """Handle abandon action."""
    result = abandon_interview(args.session_id, args.reason)
    if result["success"]:
        print(f"Interview abandoned: {args.session_id}")
        print(f"  Reason: {result['reason']}")
    else:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)


def cmd_update(args):
    """Handle update action."""
    result = update_interview(
        args.session_id,
        status=args.status,
        stage=args.stage,
        turn_count=args.turn_count,
        intake_brief_path=args.intake_brief_path
    )
    if result["success"]:
        print(f"Interview updated: {args.session_id}")
    else:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)


def cmd_save_response(args):
    """Handle save-response action."""
    result = save_response(
        args.session_id,
        args.stage,
        args.field_name,
        args.question,
        args.response,
        args.turn_number
    )
    if result["success"]:
        print(f"Response saved: turn {result['turn_number']}")
    else:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Wolf Pack Interview CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python interview.py --action start --project-slug my-project --title "My Project"
  python interview.py --action resume --session-id sess_abc123def456
  python interview.py --action list --status in_progress
  python interview.py --action list --pending-handoff
  python interview.py --action status --session-id sess_abc123def456
  python interview.py --action abandon --session-id sess_abc123def456 --reason "User canceled"
  python interview.py --action update --session-id sess_abc123def456 --status complete --stage success_criteria
        """
    )

    parser.add_argument("--action", required=True,
                       choices=["start", "resume", "list", "status", "abandon", "update", "save-response"],
                       help="Action to perform")
    parser.add_argument("--session-id", help="Interview session ID")
    parser.add_argument("--project-slug", help="Kebab-case project identifier")
    parser.add_argument("--title", help="Human-readable project title")
    parser.add_argument("--status", help="Interview status filter or new status")
    parser.add_argument("--stage", help="Current interview stage")
    parser.add_argument("--turn-count", type=int, help="Turn count to set")
    parser.add_argument("--intake-brief-path", help="Path to intake brief JSON")
    parser.add_argument("--pending-handoff", action="store_true",
                       help="List only complete interviews pending handoff")
    parser.add_argument("--reason", help="Reason for abandonment")
    parser.add_argument("--field-name", help="Field name for response")
    parser.add_argument("--question", help="Question that was asked")
    parser.add_argument("--response", help="User response text")
    parser.add_argument("--turn-number", type=int, help="Turn number for response")
    parser.add_argument("--json", action="store_true",
                       help="Output results as JSON (for programmatic access)")

    args = parser.parse_args()

    # JSON output mode - call functions directly and print JSON
    if args.json:
        result = None
        if args.action == "start":
            if not args.project_slug or not args.title:
                result = {"success": False, "error": "--project-slug and --title required for start"}
            else:
                result = start_interview(args.project_slug, args.title)
        elif args.action == "resume":
            if not args.session_id:
                result = {"success": False, "error": "--session-id required for resume"}
            else:
                result = resume_interview(args.session_id)
        elif args.action == "list":
            rows = list_interviews(status=args.status, pending_handoff=args.pending_handoff)
            result = {"success": True, "interviews": rows}
        elif args.action == "status":
            if not args.session_id:
                result = {"success": False, "error": "--session-id required for status"}
            else:
                result = get_interview_status(args.session_id)
        elif args.action == "abandon":
            if not args.session_id or not args.reason:
                result = {"success": False, "error": "--session-id and --reason required for abandon"}
            else:
                result = abandon_interview(args.session_id, args.reason)
        elif args.action == "update":
            if not args.session_id:
                result = {"success": False, "error": "--session-id required for update"}
            else:
                result = update_interview(
                    args.session_id,
                    status=args.status,
                    stage=args.stage,
                    turn_count=args.turn_count,
                    intake_brief_path=args.intake_brief_path
                )
        elif args.action == "save-response":
            if not all([args.session_id, args.stage, args.field_name,
                       args.question, args.response, args.turn_number is not None]):
                result = {"success": False, "error": "--session-id, --stage, --field-name, --question, --response, --turn-number all required"}
            else:
                result = save_response(
                    args.session_id, args.stage, args.field_name,
                    args.question, args.response, args.turn_number
                )
        print(json.dumps(result))
        sys.exit(0 if result and result.get("success", True) else 1)

    # Human-readable output mode (original behavior)
    if args.action == "start":
        if not args.project_slug or not args.title:
            print("Error: --project-slug and --title required for start", file=sys.stderr)
            sys.exit(1)
        cmd_start(args)
    elif args.action == "resume":
        if not args.session_id:
            print("Error: --session-id required for resume", file=sys.stderr)
            sys.exit(1)
        cmd_resume(args)
    elif args.action == "list":
        cmd_list(args)
    elif args.action == "status":
        if not args.session_id:
            print("Error: --session-id required for status", file=sys.stderr)
            sys.exit(1)
        cmd_status(args)
    elif args.action == "abandon":
        if not args.session_id or not args.reason:
            print("Error: --session-id and --reason required for abandon", file=sys.stderr)
            sys.exit(1)
        cmd_abandon(args)
    elif args.action == "update":
        if not args.session_id:
            print("Error: --session-id required for update", file=sys.stderr)
            sys.exit(1)
        cmd_update(args)
    elif args.action == "save-response":
        if not all([args.session_id, args.stage, args.field_name,
                   args.question, args.response, args.turn_number is not None]):
            print("Error: --session-id, --stage, --field-name, --question, --response, --turn-number all required for save-response", file=sys.stderr)
            sys.exit(1)
        cmd_save_response(args)


if __name__ == "__main__":
    main()
