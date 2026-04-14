#!/usr/bin/env python3
"""
Daily Memory Health Check

Scheduled task that checks memory system health and logs warnings.
Can be run via Windows Task Scheduler or cron.

Usage:
    python squad/memory/scripts/daily_memory_check.py
    python squad/memory/scripts/daily_memory_check.py --notify
    python squad/memory/scripts/daily_memory_check.py --stale-days 2
"""

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Resolve paths relative to script location
SCRIPT_DIR = Path(__file__).parent
SQUAD_DIR = SCRIPT_DIR.parent.parent
PROJECT_ROOT = SQUAD_DIR.parent
DB_PATH = SQUAD_DIR / "wolfpack.db"
MEMORY_DIR = SQUAD_DIR / "memory"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"


def get_memory_files_status(stale_days: int = 1) -> dict:
    """Check status of all memory files."""
    now = datetime.now()
    stale_threshold = now - timedelta(days=stale_days)

    status = {
        "pack_memory": [],
        "project_memory": [],
        "stale_files": [],
        "missing_projects": [],
        "healthy": True,
        "issues": []
    }

    # Check pack memory
    pack_files = ["PACK_STATE.md", "PATTERNS.md", "SOLUTIONS.md"]
    for fname in pack_files:
        fpath = MEMORY_DIR / fname
        if fpath.exists():
            mtime = datetime.fromtimestamp(fpath.stat().st_mtime)
            is_stale = mtime < stale_threshold
            status["pack_memory"].append({
                "file": fname,
                "last_modified": mtime.isoformat(),
                "stale": is_stale
            })
            if is_stale:
                status["stale_files"].append(f"squad/memory/{fname}")
                status["healthy"] = False
        else:
            status["issues"].append(f"Missing pack memory file: {fname}")
            status["healthy"] = False

    # Check project memory
    if ARTIFACTS_DIR.exists():
        for project_dir in ARTIFACTS_DIR.iterdir():
            if project_dir.is_dir() and not project_dir.name.startswith("."):
                memory_dir = project_dir / "memory"
                if memory_dir.exists():
                    project_files = []
                    for fname in ["CONTEXT.md", "DECISIONS.md", "CHANGELOG.md"]:
                        fpath = memory_dir / fname
                        if fpath.exists():
                            mtime = datetime.fromtimestamp(fpath.stat().st_mtime)
                            is_stale = mtime < stale_threshold
                            project_files.append({
                                "file": fname,
                                "last_modified": mtime.isoformat(),
                                "stale": is_stale
                            })
                            if is_stale:
                                status["stale_files"].append(
                                    f"artifacts/{project_dir.name}/memory/{fname}"
                                )
                                status["healthy"] = False

                    status["project_memory"].append({
                        "project": project_dir.name,
                        "files": project_files
                    })
                else:
                    # Check if project has a manifest (is a real project)
                    if (project_dir / "manifest.json").exists():
                        status["missing_projects"].append(project_dir.name)

    return status


def log_to_database(status: dict) -> None:
    """Log the health check result to the database."""
    if not DB_PATH.exists():
        print(f"Warning: Database not found at {DB_PATH}", file=sys.stderr)
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Log as a session event
        cursor.execute("""
            INSERT INTO session_logs (event_type, agent, content, created_at)
            VALUES (?, ?, ?, ?)
        """, (
            "memory_health_check",
            "system",
            json.dumps({
                "healthy": status["healthy"],
                "stale_count": len(status["stale_files"]),
                "missing_count": len(status["missing_projects"]),
                "issues": status["issues"]
            }),
            datetime.now().isoformat()
        ))

        conn.commit()
        conn.close()
    except sqlite3.Error as e:
        print(f"Database error: {e}", file=sys.stderr)


def print_report(status: dict, verbose: bool = False) -> None:
    """Print human-readable health report."""
    if status["healthy"]:
        print("Memory System Health: OK")
    else:
        print("Memory System Health: ISSUES DETECTED")

    print()

    if status["stale_files"]:
        print(f"Stale files ({len(status['stale_files'])}):")
        for f in status["stale_files"]:
            print(f"  - {f}")
        print()

    if status["missing_projects"]:
        print(f"Projects missing memory ({len(status['missing_projects'])}):")
        for p in status["missing_projects"]:
            print(f"  - {p}")
        print()

    if status["issues"]:
        print(f"Other issues ({len(status['issues'])}):")
        for issue in status["issues"]:
            print(f"  - {issue}")
        print()

    if verbose:
        print("Pack Memory:")
        for f in status["pack_memory"]:
            stale_marker = " [STALE]" if f["stale"] else ""
            print(f"  {f['file']}: {f['last_modified']}{stale_marker}")

        print()
        print("Project Memory:")
        for proj in status["project_memory"]:
            print(f"  {proj['project']}:")
            for f in proj["files"]:
                stale_marker = " [STALE]" if f["stale"] else ""
                print(f"    {f['file']}: {f['last_modified']}{stale_marker}")


def create_notification_file(status: dict) -> None:
    """Create a notification file that can trigger alerts."""
    notification_path = MEMORY_DIR / ".health_check_result"

    with open(notification_path, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "healthy": status["healthy"],
            "stale_count": len(status["stale_files"]),
            "missing_count": len(status["missing_projects"]),
            "requires_attention": not status["healthy"]
        }, f, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Daily memory system health check"
    )
    parser.add_argument(
        "--stale-days", type=int, default=1,
        help="Days after which files are considered stale (default: 1)"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show detailed file status"
    )
    parser.add_argument(
        "--json", action="store_true",
        help="Output as JSON"
    )
    parser.add_argument(
        "--notify", action="store_true",
        help="Create notification file for external alerting"
    )
    parser.add_argument(
        "--log-to-db", action="store_true",
        help="Log result to wolfpack.db"
    )

    args = parser.parse_args()

    status = get_memory_files_status(args.stale_days)

    if args.json:
        print(json.dumps(status, indent=2))
    else:
        print_report(status, args.verbose)

    if args.notify:
        create_notification_file(status)

    if args.log_to_db:
        log_to_database(status)

    # Exit with non-zero if unhealthy (for CI/scheduled task alerting)
    sys.exit(0 if status["healthy"] else 1)


if __name__ == "__main__":
    main()
