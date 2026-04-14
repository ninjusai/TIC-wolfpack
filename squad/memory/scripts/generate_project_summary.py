#!/usr/bin/env python3
"""
Generate a project summary from the Wolf Pack database.

Queries the DB using project_summary.sql and outputs formatted markdown
suitable for CONTEXT.md files.

Usage:
    python squad/memory/scripts/generate_project_summary.py mission-control
    python squad/memory/scripts/generate_project_summary.py --days 14 mission-control
"""

import argparse
import sqlite3
import os
import sys
import json
from datetime import datetime
from pathlib import Path

# Paths relative to this script
SCRIPT_DIR = Path(__file__).parent.resolve()
SQUAD_DIR = SCRIPT_DIR.parent.parent
DB_PATH = SQUAD_DIR / "wolfpack.db"
QUERY_PATH = SCRIPT_DIR.parent / "queries" / "project_summary.sql"


def get_db():
    """Connect to the Wolf Pack database."""
    if not DB_PATH.exists():
        print(f"Error: Database not found at {DB_PATH}", file=sys.stderr)
        print("Run init_db.py first.", file=sys.stderr)
        sys.exit(1)
    return sqlite3.connect(str(DB_PATH))


def load_query():
    """Load the project summary SQL query."""
    if not QUERY_PATH.exists():
        print(f"Error: Query file not found at {QUERY_PATH}", file=sys.stderr)
        sys.exit(1)
    return QUERY_PATH.read_text(encoding="utf-8")


def safe_json_loads(data):
    """Safely parse JSON data, returning empty list on failure."""
    if not data:
        return []
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return []


def format_agent_activity(agents_json):
    """Format agent activity breakdown as markdown table."""
    agents = safe_json_loads(agents_json)
    if not agents:
        return "No agent activity recorded."

    lines = ["| Agent | Reports | Last Active |", "|-------|---------|-------------|"]
    for agent in agents:
        name = agent.get("agent", "unknown")
        count = agent.get("report_count", 0)
        last = agent.get("last_active", "N/A")
        lines.append(f"| {name} | {count} | {last} |")
    return "\n".join(lines)


def format_decisions(decisions_json):
    """Format key decisions as markdown list."""
    decisions = safe_json_loads(decisions_json)
    if not decisions:
        return "No recent decisions recorded."

    lines = []
    for dec in decisions[:5]:  # Limit to 5 most recent
        date = dec.get("date", "")
        agent = dec.get("agent", "unknown")
        subject = dec.get("subject", "")
        decision = dec.get("decision", "")
        lines.append(f"- **{date}** ({agent}): {subject}")
        if decision:
            # Truncate long decisions
            truncated = decision[:200] + "..." if len(decision) > 200 else decision
            lines.append(f"  - {truncated}")
    return "\n".join(lines)


def format_issues(issues_json):
    """Format recent issues as markdown list."""
    issues = safe_json_loads(issues_json)
    if not issues:
        return "No issues reported."

    lines = []
    for issue in issues[:5]:  # Limit to 5 most recent
        date = issue.get("date", "")
        agent = issue.get("agent", "unknown")
        subject = issue.get("subject", "")
        issue_text = issue.get("issue", "")
        lines.append(f"- **{date}** ({agent}): {subject}")
        if issue_text:
            truncated = issue_text[:200] + "..." if len(issue_text) > 200 else issue_text
            lines.append(f"  - {truncated}")
    return "\n".join(lines)


def format_deliverables(deliverables_json):
    """Format recent deliverables as markdown list."""
    deliverables = safe_json_loads(deliverables_json)
    if not deliverables:
        return "No deliverables recorded."

    lines = []
    for deliv in deliverables[:10]:  # Limit to 10 most recent
        agent = deliv.get("agent", "unknown")
        subject = deliv.get("subject", "")
        files = deliv.get("deliverables", "")
        lines.append(f"- **{agent}**: {subject}")
        if files:
            truncated = files[:150] + "..." if len(files) > 150 else files
            lines.append(f"  - Files: `{truncated}`")
    return "\n".join(lines)


def generate_summary(project_slug: str, days_back: int = 30) -> str:
    """Generate a project summary markdown document."""
    db = get_db()
    query = load_query()

    # Execute query with parameters
    try:
        cursor = db.execute(query, {"days_back": days_back})
        row = cursor.fetchone()
        columns = [description[0] for description in cursor.description]
        result = dict(zip(columns, row)) if row else {}
    except sqlite3.Error as e:
        print(f"Error executing query: {e}", file=sys.stderr)
        db.close()
        sys.exit(1)
    finally:
        db.close()

    if not result:
        return f"# Project Summary: {project_slug}\n\nNo data found for the past {days_back} days."

    # Build markdown output
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    output = f"""# Project Summary: {project_slug}

Generated: {now}
Period: Last {days_back} days

---

## Task Overview

| Metric | Count |
|--------|-------|
| Total Tasks | {result.get('total_tasks', 0) or 0} |
| Completed | {result.get('completed_tasks', 0) or 0} |
| Active | {result.get('active_tasks', 0) or 0} |
| Blocked | {result.get('blocked_tasks', 0) or 0} |
| Total Reports | {result.get('total_reports', 0) or 0} |
| Active Agents | {result.get('unique_agents', 0) or 0} |

---

## Agent Activity

{format_agent_activity(result.get('agent_breakdown_json'))}

---

## Key Decisions

{format_decisions(result.get('key_decisions_json'))}

---

## Recent Issues

{format_issues(result.get('issues_json'))}

---

## Recent Deliverables

{format_deliverables(result.get('deliverables_json'))}

---

## Notes

- All agents involved: {result.get('all_agents_involved', 'None') or 'None'}
- Data source: Wolf Pack Database
- Query: project_summary.sql
"""
    return output


def main():
    parser = argparse.ArgumentParser(
        description="Generate a project summary from the Wolf Pack database.",
        epilog="Output is printed to stdout for review before committing."
    )
    parser.add_argument(
        "project",
        help="Project slug (e.g., 'mission-control')"
    )
    parser.add_argument(
        "--days", "-d",
        type=int,
        default=30,
        help="Number of days to look back (default: 30)"
    )
    parser.add_argument(
        "--output", "-o",
        help="Output file path (default: stdout)"
    )

    args = parser.parse_args()

    try:
        summary = generate_summary(args.project, args.days)

        if args.output:
            Path(args.output).write_text(summary, encoding="utf-8")
            print(f"Summary written to {args.output}", file=sys.stderr)
        else:
            print(summary)

    except Exception as e:
        print(f"Error generating summary: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
