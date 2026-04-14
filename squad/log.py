#!/usr/bin/env python3
"""Wolf Pack logging CLI. Agents use this to write to the SQLite database."""

import argparse
import sqlite3
import os
import sys
import json
import time
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wolfpack.db")
PACK_STATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "memory", "PACK_STATE.md")
DEFAULT_STALE_THRESHOLD_MINUTES = 15


def get_db():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}. Run init_db.py first.", file=sys.stderr)
        sys.exit(1)
    return sqlite3.connect(DB_PATH)


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def check_memory_staleness():
    """Check if PACK_STATE.md is stale and print warning if so."""
    threshold = int(os.environ.get("WOLFPACK_MEMORY_STALE_MINUTES",
                                    DEFAULT_STALE_THRESHOLD_MINUTES))

    if not os.path.exists(PACK_STATE_PATH):
        print("\n" + "=" * 60, file=sys.stderr)
        print("WARNING: PACK_STATE.md does not exist!", file=sys.stderr)
        print("Run: spawn Scribe to create memory files", file=sys.stderr)
        print("=" * 60 + "\n", file=sys.stderr)
        return

    mtime = os.path.getmtime(PACK_STATE_PATH)
    age_minutes = int((time.time() - mtime) / 60)

    if age_minutes > threshold:
        print("\n" + "=" * 60, file=sys.stderr)
        print(f"WARNING: Memory is stale! PACK_STATE.md last updated {age_minutes} minutes ago.",
              file=sys.stderr)
        print("Consider spawning Scribe to update memory before session ends.", file=sys.stderr)
        print("=" * 60 + "\n", file=sys.stderr)


def cmd_report(args):
    """Log a report from an agent."""
    check_memory_staleness()
    db = get_db()
    db.execute(
        """INSERT INTO reports (date, agent, subject, task_id, status, summary, decisions, deliverables, issues, next_steps)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            args.date or today(),
            args.agent,
            args.subject,
            args.task_id,
            args.status,
            args.summary,
            args.decisions,
            args.deliverables,
            args.issues,
            args.next_steps,
        ),
    )
    db.commit()
    db.close()
    print(f"Report logged: {args.agent} - {args.subject} [{args.status}]")


def cmd_task(args):
    """Create or update a task."""
    db = get_db()
    if args.action == "create":
        task_id = args.task_id or f"{today()}-{_next_task_num(db)}"
        db.execute(
            """INSERT INTO tasks (task_id, date, title, status, assigned_to, objective, context)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (task_id, today(), args.title, "pending", args.assigned_to, args.objective, args.context),
        )
        db.commit()
        db.close()
        print(f"Task created: {task_id} - {args.title}")
    elif args.action == "update":
        if not args.task_id:
            print("Error: --task-id required for update", file=sys.stderr)
            sys.exit(1)
        updates = []
        params = []
        if args.status:
            updates.append("status = ?")
            params.append(args.status)
        if args.assigned_to:
            updates.append("assigned_to = ?")
            params.append(args.assigned_to)
        if args.title:
            updates.append("title = ?")
            params.append(args.title)
        updates.append("updated_at = ?")
        params.append(now())
        params.append(args.task_id)
        db.execute(f"UPDATE tasks SET {', '.join(updates)} WHERE task_id = ?", params)
        db.commit()
        db.close()
        print(f"Task updated: {args.task_id}")
    elif args.action == "list":
        cursor = db.execute("SELECT task_id, title, status, assigned_to FROM tasks ORDER BY created_at DESC LIMIT 20")
        rows = cursor.fetchall()
        db.close()
        if not rows:
            print("No tasks found.")
            return
        for row in rows:
            print(f"  [{row[2]:^10}] {row[0]} - {row[1]} (assigned: {row[3] or 'unassigned'})")


def cmd_session(args):
    """Log a session event."""
    check_memory_staleness()
    db = get_db()
    session_id = args.session_id or today()
    db.execute(
        """INSERT INTO session_logs (date, session_id, event_type, agent, content)
           VALUES (?, ?, ?, ?, ?)""",
        (today(), session_id, args.event, args.agent, args.content),
    )
    db.commit()
    db.close()
    print(f"Session log: [{args.event}] {args.agent or ''} - {args.content[:80]}")


def cmd_agent(args):
    """Register or deactivate an agent."""
    db = get_db()
    if args.action == "register":
        db.execute(
            """INSERT OR REPLACE INTO agents (name, role, status, file, reports_to, description, created_at)
               VALUES (?, ?, 'active', ?, ?, ?, ?)""",
            (args.name, args.role, args.file, args.reports_to or "alpha", args.description, now()),
        )
        db.commit()
        db.close()
        print(f"Agent registered: {args.name} ({args.role})")
    elif args.action == "deactivate":
        db.execute(
            "UPDATE agents SET status = 'inactive', deactivated_at = ? WHERE name = ?",
            (now(), args.name),
        )
        db.commit()
        db.close()
        print(f"Agent deactivated: {args.name}")
    elif args.action == "list":
        cursor = db.execute("SELECT name, role, status FROM agents ORDER BY created_at")
        rows = cursor.fetchall()
        db.close()
        for row in rows:
            print(f"  [{row[2]:^8}] {row[0]} - {row[1]}")


def _next_task_num(db):
    cursor = db.execute("SELECT MAX(task_id) FROM tasks WHERE date = ?", (today(),))
    row = cursor.fetchone()
    max_id = row[0] if row else None
    if max_id:
        # task_id format is YYYY-MM-DD-NNN — parse the sequence number
        seq = int(max_id.rsplit("-", 1)[-1])
        return f"{seq + 1:03d}"
    return "001"


def main():
    parser = argparse.ArgumentParser(description="Wolf Pack Logging CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # report
    rp = subparsers.add_parser("report", help="Log an agent report")
    rp.add_argument("--agent", required=True)
    rp.add_argument("--subject", required=True)
    rp.add_argument("--status", default="complete", choices=["complete", "in_progress", "blocked"])
    rp.add_argument("--task-id")
    rp.add_argument("--summary", default="")
    rp.add_argument("--decisions", default="")
    rp.add_argument("--deliverables", default="")
    rp.add_argument("--issues", default="")
    rp.add_argument("--next-steps", default="")
    rp.add_argument("--date")
    rp.set_defaults(func=cmd_report)

    # task
    tp = subparsers.add_parser("task", help="Create or update a task")
    tp.add_argument("--action", required=True, choices=["create", "update", "list"])
    tp.add_argument("--task-id")
    tp.add_argument("--title", default="")
    tp.add_argument("--status")
    tp.add_argument("--assigned-to")
    tp.add_argument("--objective", default="")
    tp.add_argument("--context", default="")
    tp.set_defaults(func=cmd_task)

    # session
    sp = subparsers.add_parser("session", help="Log a session event")
    sp.add_argument("--event", required=True, choices=["request", "delegation", "report", "decision"])
    sp.add_argument("--agent", default="")
    sp.add_argument("--content", required=True)
    sp.add_argument("--session-id")
    sp.set_defaults(func=cmd_session)

    # agent
    ap = subparsers.add_parser("agent", help="Register or manage agents")
    ap.add_argument("--action", required=True, choices=["register", "deactivate", "list"])
    ap.add_argument("--name", default="")
    ap.add_argument("--role", default="")
    ap.add_argument("--file", default="")
    ap.add_argument("--reports-to", default="alpha")
    ap.add_argument("--description", default="")
    ap.set_defaults(func=cmd_agent)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
