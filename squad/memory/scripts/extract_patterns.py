#!/usr/bin/env python3
"""
Extract cross-project patterns from the Wolf Pack database.

Queries the DB using cross_project_patterns.sql and outputs candidates
for PATTERNS.md in a reviewable format.

Usage:
    python squad/memory/scripts/extract_patterns.py
    python squad/memory/scripts/extract_patterns.py --min-occurrences 3
    python squad/memory/scripts/extract_patterns.py --category workflow
"""

import argparse
import sqlite3
import os
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

# Paths relative to this script
SCRIPT_DIR = Path(__file__).parent.resolve()
SQUAD_DIR = SCRIPT_DIR.parent.parent
DB_PATH = SQUAD_DIR / "wolfpack.db"
QUERY_PATH = SCRIPT_DIR.parent / "queries" / "cross_project_patterns.sql"


def get_db():
    """Connect to the Wolf Pack database."""
    if not DB_PATH.exists():
        print(f"Error: Database not found at {DB_PATH}", file=sys.stderr)
        print("Run init_db.py first.", file=sys.stderr)
        sys.exit(1)
    return sqlite3.connect(str(DB_PATH))


def load_query():
    """Load the cross-project patterns SQL query."""
    if not QUERY_PATH.exists():
        print(f"Error: Query file not found at {QUERY_PATH}", file=sys.stderr)
        sys.exit(1)
    return QUERY_PATH.read_text(encoding="utf-8")


def safe_json_loads(data) -> List:
    """Safely parse JSON data, returning empty list on failure."""
    if not data:
        return []
    try:
        result = json.loads(data)
        return result if isinstance(result, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def format_recurring_issues(issues: List[Dict]) -> str:
    """Format recurring issues as potential pattern candidates."""
    if not issues:
        return "No recurring issues found."

    lines = ["### Recurring Issues (Potential Anti-Patterns)", ""]

    for i, issue in enumerate(issues, 1):
        text = issue.get("issue_text", "")[:200]
        count = issue.get("occurrences", 0)
        agents = issue.get("agents_affected", "")
        first_seen = issue.get("first_seen", "")
        last_seen = issue.get("last_seen", "")

        lines.append(f"#### Issue #{i}: Occurred {count} times")
        lines.append("")
        lines.append(f"**Agents affected:** {agents}")
        lines.append(f"**Period:** {first_seen} to {last_seen}")
        lines.append("")
        lines.append(f"> {text}")
        lines.append("")
        lines.append("**Potential pattern:** Consider documenting a solution pattern")
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def format_agent_patterns(agents: List[Dict]) -> str:
    """Format agent workload patterns."""
    if not agents:
        return "No agent patterns found."

    lines = [
        "### Agent Workload Patterns",
        "",
        "| Agent | Total Reports | Completion Rate | Common Work |",
        "|-------|---------------|-----------------|-------------|"
    ]

    for agent in agents:
        name = agent.get("agent", "unknown")
        total = agent.get("total_reports", 0)
        rate = agent.get("completion_rate", 0)
        subjects = agent.get("common_subjects", "")[:50]
        lines.append(f"| {name} | {total} | {rate}% | {subjects} |")

    lines.append("")
    return "\n".join(lines)


def format_blocker_patterns(blockers: List[Dict]) -> str:
    """Format blocker patterns."""
    if not blockers:
        return "No blocker patterns found."

    lines = ["### Blocker Patterns", ""]

    for blocker in blockers:
        agent = blocker.get("agent", "unknown")
        count = blocker.get("block_count", 0)
        tasks = blocker.get("blocked_tasks", "")
        contexts = blocker.get("block_contexts", "")

        lines.append(f"**{agent}** - {count} blocks")
        if tasks:
            lines.append(f"- Tasks: {tasks[:100]}")
        if contexts:
            lines.append(f"- Context: {contexts[:100]}")
        lines.append("")

    return "\n".join(lines)


def format_delegation_patterns(delegations: List[Dict]) -> str:
    """Format delegation patterns."""
    if not delegations:
        return "No delegation patterns found."

    lines = [
        "### Delegation Patterns (Alpha's Workflow)",
        "",
        "| Agent | Delegations | Sessions |",
        "|-------|-------------|----------|"
    ]

    for d in delegations:
        agent = d.get("delegate_to", "unknown")
        count = d.get("delegation_count", 0)
        sessions = d.get("sessions_involved", 0)
        lines.append(f"| {agent} | {count} | {sessions} |")

    lines.append("")
    return "\n".join(lines)


def format_topic_clusters(topics: List[Dict]) -> str:
    """Format topic clusters."""
    if not topics:
        return "No topic clusters found."

    lines = [
        "### Work Topic Clusters",
        "",
        "| Topic | Count | Agents | Period |",
        "|-------|-------|--------|--------|"
    ]

    for topic in topics:
        name = topic.get("topic", "other")
        count = topic.get("count", 0)
        agents = topic.get("agents", "")
        first = topic.get("first_occurrence", "")[:10]
        last = topic.get("last_occurrence", "")[:10]
        lines.append(f"| {name} | {count} | {agents} | {first} to {last} |")

    lines.append("")
    return "\n".join(lines)


def format_registered_patterns(patterns: List[Dict]) -> str:
    """Format existing registered patterns."""
    if not patterns:
        return "No patterns registered in database."

    lines = ["### Registered Patterns (from DB)", ""]

    for p in patterns:
        pid = p.get("pattern_id", "?")
        name = p.get("name", "Unnamed")
        category = p.get("category", "other")
        desc = p.get("description", "")[:100]
        count = p.get("occurrence_count", 0)
        confidence = p.get("confidence_score", 0)

        lines.append(f"#### {pid}: {name}")
        lines.append("")
        lines.append(f"**Category:** {category}")
        lines.append(f"**Confidence:** {confidence:.1%}")
        lines.append(f"**Occurrences:** {count}")
        if desc:
            lines.append(f"**Description:** {desc}")
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def format_solution_patterns(solutions: List[Dict]) -> str:
    """Format solution effectiveness patterns."""
    if not solutions:
        return "No solution patterns found."

    lines = [
        "### Solution Effectiveness",
        "",
        "| Problem Type | Solutions | Avg Effectiveness | Success/Fail |",
        "|--------------|-----------|-------------------|--------------|"
    ]

    for s in solutions:
        problem = s.get("problem_type", "unknown")
        count = s.get("solution_count", 0)
        eff = s.get("avg_effectiveness", 0)
        successes = s.get("total_successes", 0)
        failures = s.get("total_failures", 0)
        lines.append(f"| {problem} | {count} | {eff:.0%} | {successes}/{failures} |")

    lines.append("")
    return "\n".join(lines)


def format_activity_patterns(activities: List[Dict]) -> str:
    """Format time-based activity patterns."""
    if not activities:
        return "No activity patterns found."

    day_names = {
        "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
        "4": "Thursday", "5": "Friday", "6": "Saturday"
    }

    lines = [
        "### Activity by Day of Week",
        "",
        "| Day | Activity | Active Agents |",
        "|-----|----------|---------------|"
    ]

    for a in sorted(activities, key=lambda x: int(x.get("day_of_week", 0))):
        day = day_names.get(str(a.get("day_of_week", "?")), "?")
        count = a.get("activity_count", 0)
        agents = a.get("active_agents", 0)
        lines.append(f"| {day} | {count} | {agents} |")

    lines.append("")
    return "\n".join(lines)


def generate_pattern_candidates(min_occurrences: int = 2, category_filter: str = "%") -> str:
    """Generate pattern candidates from database analysis."""
    db = get_db()
    query = load_query()

    try:
        cursor = db.execute(query, {
            "min_occurrences": min_occurrences,
            "category_filter": category_filter
        })
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
        return "# Pattern Extraction Report\n\nNo data found."

    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    output = f"""# Cross-Project Pattern Extraction Report

Generated: {now}
Minimum occurrences: {min_occurrences}
Category filter: {category_filter}

---

## Overview

This report identifies patterns discovered from analyzing Wolf Pack activity.
Review these candidates before adding to PATTERNS.md.

---

## Discovered Patterns

{format_recurring_issues(safe_json_loads(result.get('recurring_issues_json')))}

{format_agent_patterns(safe_json_loads(result.get('agent_patterns_json')))}

{format_blocker_patterns(safe_json_loads(result.get('blocker_patterns_json')))}

{format_delegation_patterns(safe_json_loads(result.get('delegation_patterns_json')))}

{format_topic_clusters(safe_json_loads(result.get('topic_clusters_json')))}

---

## Existing Patterns

{format_registered_patterns(safe_json_loads(result.get('registered_patterns_json')))}

---

## Solution Analysis

{format_solution_patterns(safe_json_loads(result.get('solution_patterns_json')))}

---

## Activity Analysis

{format_activity_patterns(safe_json_loads(result.get('activity_patterns_json')))}

---

## Recommendations

Based on this analysis, consider:

1. **Document recurring issues** as anti-patterns with solutions
2. **Track agent specializations** for better task routing
3. **Address blocker patterns** to improve flow
4. **Update existing patterns** with new occurrence data

---

*Generated by extract_patterns.py*
"""
    return output


def main():
    parser = argparse.ArgumentParser(
        description="Extract cross-project patterns from the Wolf Pack database.",
        epilog="Output is printed to stdout for review."
    )
    parser.add_argument(
        "--min-occurrences", "-m",
        type=int,
        default=2,
        help="Minimum occurrences to be considered a pattern (default: 2)"
    )
    parser.add_argument(
        "--category", "-c",
        default="%",
        help="Filter by category (default: all)"
    )
    parser.add_argument(
        "--output", "-o",
        help="Output file path (default: stdout)"
    )

    args = parser.parse_args()

    try:
        report = generate_pattern_candidates(
            min_occurrences=args.min_occurrences,
            category_filter=args.category
        )

        if args.output:
            Path(args.output).write_text(report, encoding="utf-8")
            print(f"Report written to {args.output}", file=sys.stderr)
        else:
            print(report)

    except Exception as e:
        print(f"Error extracting patterns: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
