"""
SCR-mission-control-002 - Completeness Counter

Type: algorithmic
Applies to: EVL-CASE-mission-control-003, 004, 005, 011, 014

Check: Count the number of expected elements (projects from manifest files,
pipeline stages, artifact files in directory, DB tables) and count the number
of displayed elements. Compute: displayed_count / expected_count * 100.

Pass condition: Result = 100%. All expected elements are present.
"""

import json
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


@dataclass
class CompletenessResult:
    """Result of a completeness check."""

    passed: bool
    expected_count: int = 0
    actual_count: int = 0
    completeness_percent: float = 0.0
    missing_items: List[str] = field(default_factory=list)
    extra_items: List[str] = field(default_factory=list)
    message: str = ""

    @property
    def is_complete(self) -> bool:
        """True if completeness is 100%."""
        return self.completeness_percent >= 100.0


class CompletenessScorer:
    """
    Scorer that checks completeness of displayed data against source data.

    Checks:
    - All projects with valid manifest.json are listed
    - All pipeline stages are displayed
    - All artifact files are listed
    - All DB tables are accessible
    """

    # Expected pipeline stages
    PIPELINE_STAGES = ["problem", "eval-spec", "prd", "diagrams", "build-plan"]

    # Expected DB tables
    DB_TABLES = ["reports", "tasks", "session_logs", "agents"]

    def __init__(self, artifacts_dir: Path, db_path: Optional[Path] = None):
        """
        Initialize the Completeness Scorer.

        Args:
            artifacts_dir: Path to the artifacts directory containing project folders
            db_path: Optional path to wolfpack.db for DB checks
        """
        self.artifacts_dir = artifacts_dir
        self.db_path = db_path
        self._db_conn: Optional[sqlite3.Connection] = None

    def _get_db_connection(self) -> Optional[sqlite3.Connection]:
        """Get or create database connection."""
        if self._db_conn is None and self.db_path and self.db_path.exists():
            self._db_conn = sqlite3.connect(self.db_path)
            self._db_conn.row_factory = sqlite3.Row
        return self._db_conn

    def close(self) -> None:
        """Close database connection if open."""
        if self._db_conn:
            self._db_conn.close()
            self._db_conn = None

    def get_valid_projects(self) -> List[str]:
        """Get list of project slugs that have valid manifest.json files."""
        valid_projects = []

        if not self.artifacts_dir.exists():
            return valid_projects

        for item in self.artifacts_dir.iterdir():
            if item.is_dir():
                manifest_path = item / "manifest.json"
                if manifest_path.exists():
                    try:
                        with open(manifest_path, "r", encoding="utf-8") as f:
                            json.load(f)  # Validate JSON
                        valid_projects.append(item.name)
                    except (json.JSONDecodeError, IOError):
                        # Invalid JSON - project should not be listed
                        pass

        return sorted(valid_projects)

    def check_project_list_completeness(
        self,
        displayed_projects: List[str],
    ) -> CompletenessResult:
        """
        Check that all projects with valid manifest.json are displayed.

        EVL-CASE-003: All projects listed
        EVL-CASE-004: Missing manifest project is absent
        """
        expected_projects = set(self.get_valid_projects())
        displayed_set = set(displayed_projects)

        result = CompletenessResult(passed=True)
        result.expected_count = len(expected_projects)
        result.actual_count = len(displayed_set.intersection(expected_projects))

        # Find missing projects (should be displayed but aren't)
        missing = expected_projects - displayed_set
        result.missing_items = list(missing)

        # Find extra projects (displayed but shouldn't be - no valid manifest)
        extra = displayed_set - expected_projects
        result.extra_items = list(extra)

        if result.expected_count > 0:
            result.completeness_percent = (result.actual_count / result.expected_count) * 100
        else:
            result.completeness_percent = 100.0

        result.passed = result.completeness_percent >= 100.0 and len(result.extra_items) == 0

        result.message = (
            f"Project list completeness: {result.completeness_percent:.1f}% "
            f"({result.actual_count}/{result.expected_count})"
        )
        if result.missing_items:
            result.message += f" | Missing: {result.missing_items}"
        if result.extra_items:
            result.message += f" | Extra (no valid manifest): {result.extra_items}"

        return result

    def check_pipeline_stages_completeness(
        self,
        project_slug: str,
        displayed_stages: List[str],
    ) -> CompletenessResult:
        """
        Check that all five pipeline stages are displayed for a project.

        EVL-CASE-005: All five stages displayed
        """
        expected_stages = set(self.PIPELINE_STAGES)
        displayed_set = set(displayed_stages)

        result = CompletenessResult(passed=True)
        result.expected_count = len(expected_stages)
        result.actual_count = len(displayed_set.intersection(expected_stages))

        # Find missing stages
        missing = expected_stages - displayed_set
        result.missing_items = list(missing)

        if result.expected_count > 0:
            result.completeness_percent = (result.actual_count / result.expected_count) * 100
        else:
            result.completeness_percent = 100.0

        result.passed = result.completeness_percent >= 100.0

        result.message = (
            f"Pipeline stages for '{project_slug}': {result.completeness_percent:.1f}% "
            f"({result.actual_count}/{result.expected_count})"
        )
        if result.missing_items:
            result.message += f" | Missing: {result.missing_items}"

        return result

    def check_artifact_list_completeness(
        self,
        project_slug: str,
        displayed_artifacts: List[str],
    ) -> CompletenessResult:
        """
        Check that all artifact files in the project directory are listed.

        EVL-CASE-011: All artifact files listed
        """
        project_dir = self.artifacts_dir / project_slug
        result = CompletenessResult(passed=True)

        if not project_dir.exists():
            result.passed = False
            result.message = f"Project directory not found: {project_slug}"
            return result

        # Get all files in the project directory (recursive)
        expected_files: Set[str] = set()
        for file_path in project_dir.rglob("*"):
            if file_path.is_file():
                # Normalize to relative path with forward slashes for cross-platform consistency
                rel_path = file_path.relative_to(project_dir).as_posix()
                expected_files.add(rel_path)

        # Normalize displayed artifacts
        displayed_set = set()
        for artifact in displayed_artifacts:
            # Handle different path formats
            normalized = artifact.replace("\\", "/")
            if normalized.startswith(f"artifacts/{project_slug}/"):
                normalized = normalized.replace(f"artifacts/{project_slug}/", "")
            displayed_set.add(normalized)

        result.expected_count = len(expected_files)
        result.actual_count = len(displayed_set.intersection(expected_files))

        # Find missing files
        missing = expected_files - displayed_set
        result.missing_items = list(missing)

        if result.expected_count > 0:
            result.completeness_percent = (result.actual_count / result.expected_count) * 100
        else:
            result.completeness_percent = 100.0

        result.passed = result.completeness_percent >= 100.0

        result.message = (
            f"Artifact files for '{project_slug}': {result.completeness_percent:.1f}% "
            f"({result.actual_count}/{result.expected_count})"
        )
        if result.missing_items:
            result.message += f" | Missing: {result.missing_items}"

        return result

    def check_db_tables_completeness(
        self,
        displayed_tables: List[str],
    ) -> CompletenessResult:
        """
        Check that all four wolfpack.db tables are accessible.

        EVL-CASE-014: All four DB tables browsable
        """
        expected_tables = set(self.DB_TABLES)
        displayed_set = set(displayed_tables)

        result = CompletenessResult(passed=True)
        result.expected_count = len(expected_tables)
        result.actual_count = len(displayed_set.intersection(expected_tables))

        # Find missing tables
        missing = expected_tables - displayed_set
        result.missing_items = list(missing)

        if result.expected_count > 0:
            result.completeness_percent = (result.actual_count / result.expected_count) * 100
        else:
            result.completeness_percent = 100.0

        result.passed = result.completeness_percent >= 100.0

        result.message = (
            f"DB tables completeness: {result.completeness_percent:.1f}% "
            f"({result.actual_count}/{result.expected_count})"
        )
        if result.missing_items:
            result.message += f" | Missing: {result.missing_items}"

        return result

    def check_db_tables_exist_in_database(self) -> CompletenessResult:
        """
        Verify all expected tables exist in the actual database.

        Used for EVL-CASE-014, 021, 022 database validation.
        """
        result = CompletenessResult(passed=True)
        result.expected_count = len(self.DB_TABLES)

        conn = self._get_db_connection()
        if conn is None:
            result.passed = False
            result.message = "Database connection not available"
            return result

        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
            existing_tables = {row[0] for row in cursor.fetchall()}

            expected_set = set(self.DB_TABLES)
            result.actual_count = len(existing_tables.intersection(expected_set))

            missing = expected_set - existing_tables
            result.missing_items = list(missing)

            if result.expected_count > 0:
                result.completeness_percent = (result.actual_count / result.expected_count) * 100
            else:
                result.completeness_percent = 100.0

            result.passed = result.completeness_percent >= 100.0

            result.message = (
                f"DB tables in database: {result.completeness_percent:.1f}% "
                f"({result.actual_count}/{result.expected_count})"
            )
            if result.missing_items:
                result.message += f" | Missing: {result.missing_items}"

        except sqlite3.Error as e:
            result.passed = False
            result.message = f"Database error: {e}"

        return result

    def check_db_row_counts(
        self,
        expected_counts: Dict[str, int],
    ) -> CompletenessResult:
        """
        Verify row counts in database tables match expectations.

        Used for verifying database population.
        """
        result = CompletenessResult(passed=True)
        result.expected_count = len(expected_counts)

        conn = self._get_db_connection()
        if conn is None:
            result.passed = False
            result.message = "Database connection not available"
            return result

        try:
            cursor = conn.cursor()

            for table, expected_min in expected_counts.items():
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                actual_count = cursor.fetchone()[0]

                if actual_count >= expected_min:
                    result.actual_count += 1
                else:
                    result.missing_items.append(
                        f"{table}: expected >= {expected_min}, got {actual_count}"
                    )

            if result.expected_count > 0:
                result.completeness_percent = (result.actual_count / result.expected_count) * 100
            else:
                result.completeness_percent = 100.0

            result.passed = result.completeness_percent >= 100.0

            result.message = (
                f"DB row count check: {result.completeness_percent:.1f}% "
                f"({result.actual_count}/{result.expected_count} tables)"
            )
            if result.missing_items:
                result.message += f" | Issues: {result.missing_items}"

        except sqlite3.Error as e:
            result.passed = False
            result.message = f"Database error: {e}"

        return result
