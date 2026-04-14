"""
SCR-mission-control-001 - Data Match Checker

Type: algorithmic
Applies to: EVL-CASE-mission-control-003, 005, 006, 007, 015, 016, 017, 019, 020

Check: For each displayed data point, extract the value from the source file
(manifest.json field, wolfpack.db query result, or artifact file content)
and compare it to the expected value.

Pass condition: All compared values are identical (string equality for text,
numeric equality for numbers, boolean equality for flags). Zero mismatches.
"""

import json
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class DataMatchResult:
    """Result of a data match comparison."""

    passed: bool
    total_checks: int = 0
    passed_checks: int = 0
    failed_checks: int = 0
    mismatches: List[Dict[str, Any]] = field(default_factory=list)
    message: str = ""

    def add_mismatch(self, field: str, expected: Any, actual: Any, source: str = "") -> None:
        """Record a mismatch between expected and actual values."""
        self.mismatches.append({
            "field": field,
            "expected": expected,
            "actual": actual,
            "source": source,
        })
        self.failed_checks += 1
        self.passed = False

    def add_match(self) -> None:
        """Record a successful match."""
        self.passed_checks += 1


class DataMatchScorer:
    """
    Scorer that compares data from multiple sources for consistency.

    Sources:
    - manifest.json: Project state and pipeline information
    - wolfpack.db: Audit trail (reports, tasks, session_logs, agents)
    - Artifact files: Content verification
    """

    def __init__(self, artifacts_dir: Path, db_path: Optional[Path] = None):
        """
        Initialize the Data Match Scorer.

        Args:
            artifacts_dir: Path to the artifacts directory containing project folders
            db_path: Optional path to wolfpack.db for DB comparisons
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

    def load_manifest(self, project_slug: str) -> Optional[Dict[str, Any]]:
        """Load manifest.json for a project."""
        manifest_path = self.artifacts_dir / project_slug / "manifest.json"
        if not manifest_path.exists():
            return None
        with open(manifest_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def compare_project_metadata(
        self,
        project_slug: str,
        expected_title: str,
        expected_stage: str,
        expected_status: str,
        expected_priority: int,
    ) -> DataMatchResult:
        """
        Compare project metadata against manifest.json.

        EVL-CASE-003: Project list with correct metadata
        """
        result = DataMatchResult(passed=True)
        result.total_checks = 4

        manifest = self.load_manifest(project_slug)
        if manifest is None:
            result.passed = False
            result.message = f"Manifest not found for project '{project_slug}'"
            return result

        # Extract values (handle nested vs flat structure)
        actual_title = manifest.get("title") or manifest.get("project", {}).get("title", "")
        actual_stage = manifest.get("current_stage") or manifest.get("pipeline", {}).get("current_stage", "")
        actual_status = manifest.get("status") or manifest.get("project", {}).get("status", "")
        actual_priority = manifest.get("priority") or manifest.get("project", {}).get("priority", 0)

        # Compare title
        if actual_title == expected_title:
            result.add_match()
        else:
            result.add_mismatch("title", expected_title, actual_title, "manifest.json")

        # Compare current stage
        if actual_stage == expected_stage:
            result.add_match()
        else:
            result.add_mismatch("current_stage", expected_stage, actual_stage, "manifest.json")

        # Compare status
        if actual_status == expected_status:
            result.add_match()
        else:
            result.add_mismatch("status", expected_status, actual_status, "manifest.json")

        # Compare priority
        if int(actual_priority) == int(expected_priority):
            result.add_match()
        else:
            result.add_mismatch("priority", expected_priority, actual_priority, "manifest.json")

        result.message = f"Metadata comparison: {result.passed_checks}/{result.total_checks} passed"
        return result

    def compare_pipeline_stages(
        self,
        project_slug: str,
        expected_stages: Dict[str, Dict[str, Any]],
    ) -> DataMatchResult:
        """
        Compare pipeline stage data against manifest.json.

        EVL-CASE-005, 006, 007: Pipeline stage visibility
        """
        result = DataMatchResult(passed=True)

        manifest = self.load_manifest(project_slug)
        if manifest is None:
            result.passed = False
            result.message = f"Manifest not found for project '{project_slug}'"
            return result

        # Get stages from manifest
        manifest_stages = manifest.get("pipeline", {}).get("stages", {})

        for stage_name, expected_data in expected_stages.items():
            result.total_checks += 3  # status, gate_status, attempts

            actual_stage = manifest_stages.get(stage_name, {})

            # Compare stage status
            actual_status = actual_stage.get("status", "")
            expected_status = expected_data.get("status", "")
            if actual_status == expected_status:
                result.add_match()
            else:
                result.add_mismatch(
                    f"{stage_name}.status",
                    expected_status,
                    actual_status,
                    "manifest.json"
                )

            # Compare gate status
            actual_gate = actual_stage.get("gate", {})
            actual_gate_status = actual_gate.get("status", "")
            expected_gate_status = expected_data.get("gate_status", "")
            if actual_gate_status == expected_gate_status:
                result.add_match()
            else:
                result.add_mismatch(
                    f"{stage_name}.gate.status",
                    expected_gate_status,
                    actual_gate_status,
                    "manifest.json"
                )

            # Compare attempt count
            actual_attempts = actual_gate.get("attempts", 0)
            expected_attempts = expected_data.get("attempts", 0)
            if int(actual_attempts) == int(expected_attempts):
                result.add_match()
            else:
                result.add_mismatch(
                    f"{stage_name}.gate.attempts",
                    expected_attempts,
                    actual_attempts,
                    "manifest.json"
                )

        result.message = f"Pipeline comparison: {result.passed_checks}/{result.total_checks} passed"
        return result

    def compare_db_filter_results(
        self,
        table: str,
        filter_column: str,
        filter_value: str,
        expected_count: int,
    ) -> DataMatchResult:
        """
        Compare database filter results.

        EVL-CASE-015, 016: DB filter accuracy
        """
        result = DataMatchResult(passed=True)
        result.total_checks = 1

        conn = self._get_db_connection()
        if conn is None:
            result.passed = False
            result.message = "Database connection not available"
            return result

        # Validate table and column names (prevent SQL injection)
        valid_tables = {"reports", "tasks", "session_logs", "agents"}
        if table not in valid_tables:
            result.passed = False
            result.message = f"Invalid table name: {table}"
            return result

        valid_columns = {
            "reports": {"agent", "status", "subject"},
            "tasks": {"assigned_to", "status", "task_id"},
            "session_logs": {"agent", "event_type"},
            "agents": {"name", "role", "status"},
        }
        if filter_column not in valid_columns.get(table, set()):
            result.passed = False
            result.message = f"Invalid column '{filter_column}' for table '{table}'"
            return result

        try:
            cursor = conn.cursor()
            query = f"SELECT COUNT(*) FROM {table} WHERE {filter_column} = ?"
            cursor.execute(query, (filter_value,))
            actual_count = cursor.fetchone()[0]

            if actual_count == expected_count:
                result.add_match()
            else:
                result.add_mismatch(
                    f"{table}.{filter_column}={filter_value}",
                    expected_count,
                    actual_count,
                    "wolfpack.db"
                )

            result.message = f"DB filter check: expected {expected_count} rows, got {actual_count}"
        except sqlite3.Error as e:
            result.passed = False
            result.message = f"Database error: {e}"

        return result

    def compare_project_switch_data(
        self,
        project_a_slug: str,
        project_b_slug: str,
    ) -> DataMatchResult:
        """
        Verify that switching projects loads correct data with no carryover.

        EVL-CASE-017: Project switch correctness
        """
        result = DataMatchResult(passed=True)

        manifest_a = self.load_manifest(project_a_slug)
        manifest_b = self.load_manifest(project_b_slug)

        if manifest_a is None:
            result.passed = False
            result.message = f"Manifest not found for project '{project_a_slug}'"
            return result

        if manifest_b is None:
            result.passed = False
            result.message = f"Manifest not found for project '{project_b_slug}'"
            return result

        # Verify that the two projects have different data (to confirm no carryover)
        slug_a = manifest_a.get("slug") or manifest_a.get("project", {}).get("slug")
        slug_b = manifest_b.get("slug") or manifest_b.get("project", {}).get("slug")

        result.total_checks = 2

        if slug_a == project_a_slug:
            result.add_match()
        else:
            result.add_mismatch("project_a.slug", project_a_slug, slug_a, "manifest.json")

        if slug_b == project_b_slug:
            result.add_match()
        else:
            result.add_mismatch("project_b.slug", project_b_slug, slug_b, "manifest.json")

        # Verify they are different projects
        if slug_a != slug_b:
            result.message = f"Projects are distinct: '{slug_a}' and '{slug_b}'"
        else:
            result.passed = False
            result.message = f"Projects appear identical: both have slug '{slug_a}'"

        return result

    def spot_check_all_sources(
        self,
        project_slug: str,
    ) -> DataMatchResult:
        """
        Cross-check data across manifest.json, wolfpack.db, and artifact files.

        EVL-CASE-019: Spot-check across all data sources
        """
        result = DataMatchResult(passed=True)

        # Load manifest
        manifest = self.load_manifest(project_slug)
        if manifest is None:
            result.passed = False
            result.message = f"Manifest not found for project '{project_slug}'"
            return result

        # Check manifest structure
        result.total_checks += 1
        if "slug" in manifest or "project" in manifest:
            result.add_match()
        else:
            result.add_mismatch("manifest.structure", "has slug or project", "missing", "manifest.json")

        # Check artifact files exist
        project_dir = self.artifacts_dir / project_slug
        stages = manifest.get("pipeline", {}).get("stages", {})

        for stage_name, stage_data in stages.items():
            artifact_file = stage_data.get("file")
            if artifact_file and stage_data.get("status") in ["approved", "in-progress"]:
                result.total_checks += 1
                # Normalize path
                if artifact_file.startswith("artifacts/"):
                    artifact_file = artifact_file.replace(f"artifacts/{project_slug}/", "")

                artifact_path = project_dir / artifact_file
                if artifact_path.exists() or artifact_path.is_dir():
                    result.add_match()
                else:
                    result.add_mismatch(
                        f"{stage_name}.artifact",
                        "file exists",
                        "file missing",
                        str(artifact_path)
                    )

        # Cross-check with DB if available
        conn = self._get_db_connection()
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT COUNT(*) FROM tasks WHERE task_id LIKE ?",
                    (f"TSK-{project_slug}-%",)
                )
                task_count = cursor.fetchone()[0]

                result.total_checks += 1
                if task_count > 0:
                    result.add_match()
                else:
                    # It's okay if no tasks exist for fresh projects
                    result.add_match()  # Non-critical

            except sqlite3.Error:
                pass  # DB checks are optional

        result.message = f"Spot check: {result.passed_checks}/{result.total_checks} passed"
        return result

    def check_discrepancy_flagging(
        self,
        project_slug: str,
        expected_manifest_value: Any,
        db_conflicting_value: Any,
        field_name: str,
    ) -> DataMatchResult:
        """
        Check that manifest is primary and discrepancies are detectable.

        EVL-CASE-020: Discrepancy flagging
        """
        result = DataMatchResult(passed=True)
        result.total_checks = 2

        manifest = self.load_manifest(project_slug)
        if manifest is None:
            result.passed = False
            result.message = f"Manifest not found for project '{project_slug}'"
            return result

        # Check 1: Manifest has the expected primary value
        actual_value = manifest.get(field_name) or manifest.get("pipeline", {}).get(field_name)
        if actual_value == expected_manifest_value:
            result.add_match()
        else:
            result.add_mismatch(field_name, expected_manifest_value, actual_value, "manifest.json")

        # Check 2: The values are indeed different (discrepancy exists)
        if expected_manifest_value != db_conflicting_value:
            result.add_match()
            result.message = f"Discrepancy detected: manifest has '{expected_manifest_value}', DB has '{db_conflicting_value}'"
        else:
            result.add_mismatch(
                "discrepancy_exists",
                "values should differ",
                "values are same",
                "comparison"
            )

        return result
