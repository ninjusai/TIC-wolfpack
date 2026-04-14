#!/usr/bin/env python3
"""
Show status of all memory files across projects.

Reports on:
- Last updated timestamps and staleness
- Projects missing memory directories
- File sizes and health indicators

Usage:
    python squad/memory/scripts/memory_status.py
    python squad/memory/scripts/memory_status.py --stale-days 7
    python squad/memory/scripts/memory_status.py --json
"""

import argparse
import os
import sys
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Any

# Paths relative to this script
SCRIPT_DIR = Path(__file__).parent.resolve()
SQUAD_DIR = SCRIPT_DIR.parent.parent
PROJECT_ROOT = SQUAD_DIR.parent
DB_PATH = SQUAD_DIR / "wolfpack.db"
PACK_MEMORY_DIR = SCRIPT_DIR.parent


# Expected memory files per project
PROJECT_MEMORY_FILES = [
    "CONTEXT.md",
    "DECISIONS.md",
    "CHANGELOG.md"
]

# Pack-level memory files
PACK_MEMORY_FILES = [
    "PACK_STATE.md",
    "PATTERNS.md",
    "SOLUTIONS.md"
]


def get_file_info(path: Path) -> Optional[Dict]:
    """Get information about a file."""
    if not path.exists():
        return None

    stat = path.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime)
    now = datetime.now()
    age_days = (now - mtime).days

    # Count lines (rough measure of content)
    try:
        content = path.read_text(encoding="utf-8")
        line_count = len(content.splitlines())
        size_bytes = len(content.encode("utf-8"))
    except Exception:
        line_count = 0
        size_bytes = stat.st_size

    return {
        "path": str(path),
        "exists": True,
        "modified": mtime.strftime("%Y-%m-%d %H:%M"),
        "age_days": age_days,
        "size_bytes": size_bytes,
        "line_count": line_count
    }


def format_size(bytes_count: int) -> str:
    """Format bytes as human-readable size."""
    if bytes_count < 1024:
        return f"{bytes_count} B"
    elif bytes_count < 1024 * 1024:
        return f"{bytes_count / 1024:.1f} KB"
    else:
        return f"{bytes_count / (1024 * 1024):.1f} MB"


def get_staleness_indicator(age_days: int, stale_threshold: int) -> str:
    """Get a staleness indicator for display."""
    if age_days == 0:
        return "FRESH"
    elif age_days <= 1:
        return "recent"
    elif age_days <= stale_threshold:
        return f"{age_days}d"
    else:
        return f"STALE ({age_days}d)"


def find_projects() -> List[str]:
    """Find all project directories in artifacts/."""
    artifacts_dir = PROJECT_ROOT / "artifacts"
    projects = []

    if artifacts_dir.exists():
        for item in artifacts_dir.iterdir():
            if item.is_dir() and not item.name.startswith("."):
                projects.append(item.name)

    return sorted(projects)


def get_db_projects() -> List[str]:
    """Get projects mentioned in the database (from tasks/reports)."""
    if not DB_PATH.exists():
        return []

    try:
        db = sqlite3.connect(str(DB_PATH))
        # Look for project references in task context or titles
        cursor = db.execute("""
            SELECT DISTINCT
                CASE
                    WHEN context LIKE '%project:%' THEN
                        substr(context, instr(context, 'project:') + 8, 20)
                    ELSE NULL
                END as project
            FROM tasks
            WHERE context LIKE '%project:%'
        """)
        projects = [row[0] for row in cursor.fetchall() if row[0]]
        db.close()
        return projects
    except sqlite3.Error:
        return []


def check_pack_memory(stale_threshold: int) -> Dict:
    """Check pack-level memory files."""
    result = {
        "location": str(PACK_MEMORY_DIR),
        "files": {}
    }

    for filename in PACK_MEMORY_FILES:
        filepath = PACK_MEMORY_DIR / filename
        info = get_file_info(filepath)
        if info:
            info["status"] = "ok" if info["age_days"] <= stale_threshold else "stale"
        else:
            info = {
                "path": str(filepath),
                "exists": False,
                "status": "missing"
            }
        result["files"][filename] = info

    return result


def check_project_memory(project: str, stale_threshold: int) -> Dict:
    """Check memory files for a specific project."""
    memory_dir = PROJECT_ROOT / "artifacts" / project / "memory"

    result = {
        "project": project,
        "memory_dir": str(memory_dir),
        "has_memory_dir": memory_dir.exists(),
        "files": {}
    }

    for filename in PROJECT_MEMORY_FILES:
        filepath = memory_dir / filename
        info = get_file_info(filepath)
        if info:
            info["status"] = "ok" if info["age_days"] <= stale_threshold else "stale"
        else:
            info = {
                "path": str(filepath),
                "exists": False,
                "status": "missing"
            }
        result["files"][filename] = info

    return result


def generate_status_report(stale_threshold: int = 7) -> Dict:
    """Generate a complete memory status report."""
    report = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "stale_threshold_days": stale_threshold,
        "pack_memory": check_pack_memory(stale_threshold),
        "projects": {}
    }

    # Find all projects
    projects = find_projects()
    db_projects = get_db_projects()
    all_projects = sorted(set(projects + db_projects))

    report["projects_found"] = len(all_projects)
    report["projects_with_memory"] = 0
    report["projects_missing_memory"] = []

    for project in all_projects:
        status = check_project_memory(project, stale_threshold)
        report["projects"][project] = status

        if status["has_memory_dir"]:
            report["projects_with_memory"] += 1
        else:
            report["projects_missing_memory"].append(project)

    return report


def format_text_report(report: Dict) -> str:
    """Format the report as human-readable text."""
    lines = [
        "=" * 70,
        "WOLF PACK MEMORY STATUS REPORT",
        "=" * 70,
        f"Generated: {report['generated_at']}",
        f"Stale threshold: {report['stale_threshold_days']} days",
        "",
        "-" * 70,
        "PACK MEMORY (squad/memory/)",
        "-" * 70,
    ]

    pack = report["pack_memory"]
    for filename, info in pack["files"].items():
        if info["exists"]:
            staleness = get_staleness_indicator(info["age_days"], report["stale_threshold_days"])
            size = format_size(info["size_bytes"])
            lines.append(f"  [{info['status']:^7}] {filename:<20} {staleness:>12} {size:>10} ({info['line_count']} lines)")
        else:
            lines.append(f"  [MISSING] {filename:<20}")

    lines.extend([
        "",
        "-" * 70,
        f"PROJECT MEMORY ({report['projects_found']} projects found)",
        "-" * 70,
    ])

    if report["projects_missing_memory"]:
        lines.append("")
        lines.append("  MISSING MEMORY DIRECTORIES:")
        for project in report["projects_missing_memory"]:
            lines.append(f"    - {project}")
        lines.append("")

    for project, status in report["projects"].items():
        if not status["has_memory_dir"]:
            continue  # Already listed above

        lines.append(f"\n  {project}/")
        for filename, info in status["files"].items():
            if info["exists"]:
                staleness = get_staleness_indicator(info["age_days"], report["stale_threshold_days"])
                size = format_size(info["size_bytes"])
                lines.append(f"    [{info['status']:^7}] {filename:<20} {staleness:>12} {size:>10}")
            else:
                lines.append(f"    [MISSING] {filename:<20}")

    # Summary
    lines.extend([
        "",
        "-" * 70,
        "SUMMARY",
        "-" * 70,
        f"  Projects with memory: {report['projects_with_memory']}/{report['projects_found']}",
        f"  Projects missing memory: {len(report['projects_missing_memory'])}",
    ])

    # Count stale files
    stale_count = 0
    missing_count = 0

    for info in pack["files"].values():
        if not info["exists"]:
            missing_count += 1
        elif info.get("status") == "stale":
            stale_count += 1

    for status in report["projects"].values():
        for info in status["files"].values():
            if not info["exists"]:
                missing_count += 1
            elif info.get("status") == "stale":
                stale_count += 1

    lines.extend([
        f"  Stale files: {stale_count}",
        f"  Missing files: {missing_count}",
        "",
    ])

    # Recommendations
    if stale_count > 0 or missing_count > 0:
        lines.append("RECOMMENDATIONS:")
        if report["projects_missing_memory"]:
            lines.append("  - Create memory directories for projects listed above")
        if stale_count > 0:
            lines.append("  - Update stale files (marked STALE)")
        if missing_count > 0:
            lines.append("  - Create missing memory files from templates")

    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Show status of all Wolf Pack memory files.",
        epilog="Reports on memory file health across all projects."
    )
    parser.add_argument(
        "--stale-days", "-s",
        type=int,
        default=7,
        help="Days after which a file is considered stale (default: 7)"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON instead of text"
    )
    parser.add_argument(
        "--project", "-p",
        help="Check only a specific project"
    )

    args = parser.parse_args()

    try:
        if args.project:
            # Single project check
            status = check_project_memory(args.project, args.stale_days)
            if args.json:
                print(json.dumps(status, indent=2))
            else:
                print(f"Memory status for: {args.project}")
                print(f"Directory: {status['memory_dir']}")
                print(f"Has memory dir: {status['has_memory_dir']}")
                print()
                for filename, info in status["files"].items():
                    if info["exists"]:
                        print(f"  {filename}: {info['status']} (modified {info['modified']})")
                    else:
                        print(f"  {filename}: MISSING")
        else:
            # Full report
            report = generate_status_report(args.stale_days)

            if args.json:
                print(json.dumps(report, indent=2))
            else:
                print(format_text_report(report))

    except Exception as e:
        print(f"Error generating status report: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
