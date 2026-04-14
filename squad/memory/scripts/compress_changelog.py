#!/usr/bin/env python3
"""
Compress and archive old changelog entries.

Reads a project's CHANGELOG.md, compresses entries older than 7 days into
summaries, and archives entries older than 30 days to CHANGELOG_ARCHIVE.md.

Usage:
    python squad/memory/scripts/compress_changelog.py mission-control
    python squad/memory/scripts/compress_changelog.py --compress-days 7 --archive-days 30 mission-control
"""

import argparse
import re
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
from typing import List, Dict, Tuple, Optional

# Paths relative to this script
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent


def find_changelog(project_slug: str) -> Optional[Path]:
    """Find the CHANGELOG.md for a project."""
    # Check artifacts/{project}/memory/CHANGELOG.md
    changelog_path = PROJECT_ROOT / "artifacts" / project_slug / "memory" / "CHANGELOG.md"
    if changelog_path.exists():
        return changelog_path

    # Also check if there's a memory directory at project level
    alt_path = PROJECT_ROOT / project_slug / "memory" / "CHANGELOG.md"
    if alt_path.exists():
        return alt_path

    return None


def parse_date(date_str: str) -> Optional[datetime]:
    """Parse a date string in YYYY-MM-DD format."""
    try:
        return datetime.strptime(date_str.strip(), "%Y-%m-%d")
    except ValueError:
        return None


def parse_changelog(content: str) -> Tuple[str, List[Dict]]:
    """
    Parse a CHANGELOG.md file into header and entries.

    Returns:
        Tuple of (header_content, list_of_entries)
        Each entry is a dict with 'date', 'content', 'agents', 'tasks'
    """
    lines = content.split("\n")
    header_lines = []
    entries = []
    current_entry = None
    current_date = None
    in_header = True

    # Pattern to match date headers like "## 2026-03-31"
    date_pattern = re.compile(r"^##\s+(\d{4}-\d{2}-\d{2})\s*$")
    # Pattern to match agent entries like "### 14:30 - forge"
    agent_pattern = re.compile(r"^###\s+(\d{2}:\d{2})\s*-\s*(\w+)")
    # Pattern to match task references
    task_pattern = re.compile(r"\*\*Task:\*\*\s*(.+)")

    for line in lines:
        date_match = date_pattern.match(line)

        if date_match:
            in_header = False
            # Save previous entry if exists
            if current_entry and current_date:
                entries.append({
                    "date": current_date,
                    "content": "\n".join(current_entry),
                    "agents": [],
                    "tasks": []
                })
            current_date = date_match.group(1)
            current_entry = [line]
        elif in_header:
            header_lines.append(line)
        elif current_entry is not None:
            current_entry.append(line)
            # Track agents and tasks
            agent_match = agent_pattern.match(line)
            if agent_match and entries:
                pass  # Will be processed when entry is saved
            task_match = task_pattern.search(line)
            if task_match:
                pass  # Will be processed when entry is saved

    # Don't forget the last entry
    if current_entry and current_date:
        entries.append({
            "date": current_date,
            "content": "\n".join(current_entry),
            "agents": [],
            "tasks": []
        })

    # Extract agents and tasks from each entry
    for entry in entries:
        content = entry["content"]
        entry["agents"] = list(set(agent_pattern.findall(content)))
        entry["tasks"] = task_pattern.findall(content)

    return "\n".join(header_lines), entries


def compress_entries(entries: List[Dict], compress_days: int) -> Tuple[List[Dict], List[Dict]]:
    """
    Separate entries into recent (keep as-is) and old (to compress).

    Returns:
        Tuple of (recent_entries, entries_to_compress)
    """
    cutoff = datetime.now() - timedelta(days=compress_days)
    recent = []
    to_compress = []

    for entry in entries:
        entry_date = parse_date(entry["date"])
        if entry_date and entry_date < cutoff:
            to_compress.append(entry)
        else:
            recent.append(entry)

    return recent, to_compress


def generate_compressed_summary(entries: List[Dict]) -> str:
    """Generate a compressed summary of multiple entries."""
    if not entries:
        return ""

    # Group by week
    weeks = defaultdict(list)
    for entry in entries:
        entry_date = parse_date(entry["date"])
        if entry_date:
            week_start = entry_date - timedelta(days=entry_date.weekday())
            week_key = week_start.strftime("%Y-%m-%d")
            weeks[week_key].append(entry)

    lines = ["## Compressed Entries", ""]

    for week_start in sorted(weeks.keys(), reverse=True):
        week_entries = weeks[week_start]
        week_end = (parse_date(week_start) + timedelta(days=6)).strftime("%Y-%m-%d")

        # Collect all agents and count entries
        all_agents = set()
        all_tasks = []
        for entry in week_entries:
            for time_str, agent in entry["agents"]:
                all_agents.add(agent)
            all_tasks.extend(entry["tasks"])

        lines.append(f"### Week of {week_start} to {week_end}")
        lines.append("")
        lines.append(f"**Entries:** {len(week_entries)}")
        lines.append(f"**Agents:** {', '.join(sorted(all_agents)) or 'N/A'}")
        if all_tasks:
            lines.append(f"**Tasks:** {len(all_tasks)} completed")
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def archive_entries(entries: List[Dict], archive_days: int) -> Tuple[List[Dict], List[Dict]]:
    """
    Separate entries into keep and archive based on age.

    Returns:
        Tuple of (entries_to_keep, entries_to_archive)
    """
    cutoff = datetime.now() - timedelta(days=archive_days)
    keep = []
    archive = []

    for entry in entries:
        entry_date = parse_date(entry["date"])
        if entry_date and entry_date < cutoff:
            archive.append(entry)
        else:
            keep.append(entry)

    return keep, archive


def format_archive_content(entries: List[Dict], project_slug: str) -> str:
    """Format entries for the archive file."""
    if not entries:
        return ""

    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [
        f"# Changelog Archive: {project_slug}",
        "",
        f"Archived: {now}",
        "",
        "---",
        ""
    ]

    for entry in sorted(entries, key=lambda e: e["date"], reverse=True):
        lines.append(entry["content"])
        lines.append("")

    return "\n".join(lines)


def process_changelog(
    project_slug: str,
    compress_days: int = 7,
    archive_days: int = 30,
    dry_run: bool = True
) -> Dict:
    """
    Process a project's changelog: compress old entries, archive ancient ones.

    Returns:
        Dict with processing results
    """
    changelog_path = find_changelog(project_slug)

    if not changelog_path:
        return {
            "success": False,
            "error": f"CHANGELOG.md not found for project '{project_slug}'",
            "searched": [
                str(PROJECT_ROOT / "artifacts" / project_slug / "memory" / "CHANGELOG.md"),
                str(PROJECT_ROOT / project_slug / "memory" / "CHANGELOG.md")
            ]
        }

    content = changelog_path.read_text(encoding="utf-8")
    header, entries = parse_changelog(content)

    # Separate entries
    recent, to_compress = compress_entries(entries, compress_days)
    keep_compressed, to_archive = archive_entries(to_compress, archive_days)

    result = {
        "success": True,
        "changelog_path": str(changelog_path),
        "total_entries": len(entries),
        "recent_entries": len(recent),
        "compressed_entries": len(keep_compressed),
        "archived_entries": len(to_archive),
        "dry_run": dry_run
    }

    # Generate new changelog content
    new_content_lines = [header]

    # Add recent entries (unchanged)
    for entry in recent:
        new_content_lines.append(entry["content"])

    # Add compressed summary for middle-aged entries
    if keep_compressed:
        new_content_lines.append("")
        new_content_lines.append(generate_compressed_summary(keep_compressed))

    new_content = "\n".join(new_content_lines)
    result["new_changelog"] = new_content

    # Generate archive content
    if to_archive:
        archive_content = format_archive_content(to_archive, project_slug)
        archive_path = changelog_path.parent / "CHANGELOG_ARCHIVE.md"
        result["archive_path"] = str(archive_path)
        result["archive_content"] = archive_content

        if not dry_run:
            # Append to existing archive or create new
            if archive_path.exists():
                existing = archive_path.read_text(encoding="utf-8")
                archive_content = existing + "\n\n---\n\n" + archive_content
            archive_path.write_text(archive_content, encoding="utf-8")

    if not dry_run:
        changelog_path.write_text(new_content, encoding="utf-8")

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Compress and archive old changelog entries.",
        epilog="By default, outputs to stdout for review. Use --write to modify files."
    )
    parser.add_argument(
        "project",
        help="Project slug (e.g., 'mission-control')"
    )
    parser.add_argument(
        "--compress-days",
        type=int,
        default=7,
        help="Compress entries older than this many days (default: 7)"
    )
    parser.add_argument(
        "--archive-days",
        type=int,
        default=30,
        help="Archive entries older than this many days (default: 30)"
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Actually write changes to files (default: dry run)"
    )
    parser.add_argument(
        "--show-archive",
        action="store_true",
        help="Also show archive content in output"
    )

    args = parser.parse_args()

    try:
        result = process_changelog(
            args.project,
            compress_days=args.compress_days,
            archive_days=args.archive_days,
            dry_run=not args.write
        )

        if not result["success"]:
            print(f"Error: {result['error']}", file=sys.stderr)
            if "searched" in result:
                print("Searched locations:", file=sys.stderr)
                for path in result["searched"]:
                    print(f"  - {path}", file=sys.stderr)
            sys.exit(1)

        # Print summary
        print("=" * 60)
        print(f"Changelog Compression Report: {args.project}")
        print("=" * 60)
        print(f"Source: {result['changelog_path']}")
        print(f"Mode: {'WRITE' if args.write else 'DRY RUN'}")
        print()
        print(f"Total entries found: {result['total_entries']}")
        print(f"  - Recent (kept as-is): {result['recent_entries']}")
        print(f"  - Compressed (7-30 days): {result['compressed_entries']}")
        print(f"  - Archived (>30 days): {result['archived_entries']}")
        print()

        if "archive_path" in result:
            print(f"Archive location: {result['archive_path']}")
            print()

        print("=" * 60)
        print("NEW CHANGELOG CONTENT:")
        print("=" * 60)
        print(result["new_changelog"])

        if args.show_archive and "archive_content" in result:
            print()
            print("=" * 60)
            print("ARCHIVE CONTENT:")
            print("=" * 60)
            print(result["archive_content"])

        if not args.write:
            print()
            print("(Dry run - no files modified. Use --write to apply changes.)")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
