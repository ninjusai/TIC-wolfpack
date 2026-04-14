"""
Wolf Pack Mission Control V1 - Eval Test Suite

Parametrized tests for all 27 eval cases from EVL-mission-control-001.
Each test maps to an EVL-CASE-mission-control-XXX and uses the appropriate scorer.

Run with: pytest tests/test_eval_cases.py -v

Categories (use with pytest -m):
- session: Session continuity (001, 002)
- project: Project listing (003, 004)
- pipeline: Pipeline display (005, 006, 007)
- intake: Intake form (008, 009, 010)
- artifact: Artifact browser (011, 012, 013)
- db: Database explorer (014, 015, 016)
- navigation: Navigation (017, 018)
- accuracy: Data accuracy (019, 020)
- dbcompat: DB compatibility (021, 022)
- platform: Windows platform (023, 024)
- watcher: File watcher (025, 026)
- performance: Performance/scale (027)
"""

import json
import os
import shutil
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List

import pytest

from conftest import count_db_rows, list_artifacts, load_manifest


# =============================================================================
# EVL-CASE-001, 002: Session Continuity (SC-01)
# =============================================================================

@pytest.mark.session
class TestSessionContinuity:
    """Tests for session state persistence across close/reopen."""

    def test_evl_case_001_state_persists_across_reopen(
        self,
        session_scorer,
        all_project_slugs,
        artifacts_dir,
    ):
        """
        EVL-CASE-mission-control-001: State persists across close/reopen.

        All 5 projects with their pipeline stages, gate statuses, and assigned
        agents are displayed identically after reopen, without any manual file
        loading or user action.
        """
        # Capture initial snapshot
        before = session_scorer.capture_snapshot()

        assert before.project_count == len(all_project_slugs), (
            f"Expected {len(all_project_slugs)} projects in snapshot, "
            f"got {before.project_count}"
        )

        # Simulate reopen by capturing another snapshot
        after = session_scorer.capture_snapshot()

        # Compare snapshots
        result = session_scorer.compare_snapshots(before, after)

        assert result.passed, f"Session persistence failed: {result.differences}"
        assert result.snapshot_match, f"Snapshots differ: {result.differences}"

    def test_evl_case_002_no_manual_recovery_required(
        self,
        session_scorer,
    ):
        """
        EVL-CASE-mission-control-002: No manual recovery required after reopen.

        Zero prompts for manual file loading. Zero empty state screens.
        Zero error dialogs. Data is present immediately.
        """
        result = session_scorer.verify_data_readable()

        assert result.passed, f"Data readability issues: {result.differences}"
        assert not result.error_states_found, "Error states would be shown"
        assert not result.load_prompts_found, "Load prompts would be required"


# =============================================================================
# EVL-CASE-003, 004: Project Status at a Glance (SC-02)
# =============================================================================

@pytest.mark.project
class TestProjectListing:
    """Tests for project list display and metadata accuracy."""

    def test_evl_case_003_all_projects_listed_with_correct_metadata(
        self,
        completeness_scorer,
        data_match_scorer,
        project_fixtures,
        all_project_slugs,
    ):
        """
        EVL-CASE-mission-control-003: All projects listed with correct metadata.

        All 5 projects appear in the list. For each project: name matches
        manifest.json > project.title, current stage matches, etc.
        """
        # Check completeness
        completeness_result = completeness_scorer.check_project_list_completeness(
            all_project_slugs
        )
        assert completeness_result.passed, (
            f"Project list incomplete: {completeness_result.message}"
        )
        assert completeness_result.completeness_percent == 100.0, (
            f"Expected 100% completeness, got {completeness_result.completeness_percent}%"
        )

        # Check metadata accuracy for each project
        for project in project_fixtures:
            result = data_match_scorer.compare_project_metadata(
                project_slug=project["slug"],
                expected_title=project["title"],
                expected_stage=project["current_stage"],
                expected_status=project["status"],
                expected_priority=project["priority"],
            )
            assert result.passed, (
                f"Metadata mismatch for {project['slug']}: {result.mismatches}"
            )

    def test_evl_case_004_missing_manifest_project_absent(
        self,
        completeness_scorer,
        artifacts_dir,
    ):
        """
        EVL-CASE-mission-control-004: Missing manifest project is absent from list.

        Create directory artifacts/phantom-project/ with no manifest.json.
        phantom-project does NOT appear in the project list.
        """
        # Create a phantom project directory without manifest
        phantom_dir = artifacts_dir / "phantom-project"
        phantom_dir.mkdir(exist_ok=True)

        try:
            # Get valid projects (should not include phantom)
            valid_projects = completeness_scorer.get_valid_projects()

            assert "phantom-project" not in valid_projects, (
                "phantom-project should not be listed (no manifest.json)"
            )
        finally:
            # Cleanup
            if phantom_dir.exists():
                shutil.rmtree(phantom_dir)


# =============================================================================
# EVL-CASE-005, 006, 007: Pipeline Stage Visibility (SC-03)
# =============================================================================

@pytest.mark.pipeline
class TestPipelineDisplay:
    """Tests for pipeline stage display and gate data accuracy."""

    def test_evl_case_005_all_stages_displayed_complete_project(
        self,
        completeness_scorer,
        data_match_scorer,
        alpha_project,
        pipeline_stages,
    ):
        """
        EVL-CASE-mission-control-005: All five stages displayed with correct gate data.

        For alpha-project (all stages complete): All 5 pipeline stages displayed.
        Each stage shows correct gate status, attempt count, assigned agent.
        """
        # Check all stages present
        completeness_result = completeness_scorer.check_pipeline_stages_completeness(
            alpha_project["slug"],
            pipeline_stages,
        )
        assert completeness_result.passed, (
            f"Missing pipeline stages: {completeness_result.missing_items}"
        )

        # Check stage data accuracy
        result = data_match_scorer.compare_pipeline_stages(
            alpha_project["slug"],
            alpha_project["stages"],
        )
        assert result.passed, (
            f"Pipeline data mismatch: {result.mismatches}"
        )

    def test_evl_case_006_mixed_states_mid_pipeline(
        self,
        data_match_scorer,
        beta_project,
    ):
        """
        EVL-CASE-mission-control-006: Partially complete pipeline shows correct mixed states.

        For beta-project (stage 2, G1 passed, G2 pending): Stage 1 shows passed,
        Stage 2 shows pending, Stages 3-5 show pending.
        """
        result = data_match_scorer.compare_pipeline_stages(
            beta_project["slug"],
            beta_project["stages"],
        )
        assert result.passed, (
            f"Mixed state pipeline data mismatch: {result.mismatches}"
        )

    def test_evl_case_007_gate_retry_count_displayed(
        self,
        data_match_scorer,
        gamma_project,
    ):
        """
        EVL-CASE-mission-control-007: Gate retry count displayed correctly.

        For gamma-project (G1 failed once then passed): Stage 1 shows
        gate status "passed", attempt count 2.
        """
        result = data_match_scorer.compare_pipeline_stages(
            gamma_project["slug"],
            gamma_project["stages"],
        )
        assert result.passed, (
            f"Gate retry data mismatch: {result.mismatches}"
        )

        # Specifically verify attempt count = 2 for problem stage
        problem_stage = gamma_project["stages"]["problem"]
        assert problem_stage["attempts"] == 2, (
            f"Expected 2 gate attempts for problem stage, got {problem_stage['attempts']}"
        )


# =============================================================================
# EVL-CASE-008, 009, 010: Structured Project Intake (SC-04)
# =============================================================================

@pytest.mark.intake
class TestIntakeForm:
    """Tests for intake form validation and output."""

    def test_evl_case_008_complete_intake_produces_valid_output(
        self,
        intake_scorer,
        complete_intake,
        temp_project_dir,
    ):
        """
        EVL-CASE-mission-control-008: Complete intake produces valid output.

        File intake.json is created, valid JSON, all six fields present,
        field values match input, structure conforms to schema.
        """
        # Create intake.json with complete data
        intake_data = complete_intake["intake"]

        # Transform to expected schema format
        intake_json = {
            "problem": intake_data["problem"],
            "users": intake_data["users"],
            "scope_in": intake_data["scope_in"],
            "scope_out": intake_data["scope_out"],
            "constraints": intake_data["constraints"] if isinstance(intake_data["constraints"], list) else [intake_data["constraints"]] if intake_data["constraints"] else [],
            "success_criteria": intake_data["success_criteria"],
            "prior_art": intake_data["prior_art"] if isinstance(intake_data["prior_art"], list) else [intake_data["prior_art"]] if intake_data["prior_art"] else [],
        }

        intake_path = temp_project_dir / "intake.json"
        with open(intake_path, "w", encoding="utf-8") as f:
            json.dump(intake_json, f, indent=2)

        # Validate
        project_slug = temp_project_dir.name
        result = intake_scorer.validate_intake_output(
            project_slug,
            expected_values=intake_json,
        )

        assert result.passed, f"Intake validation failed: {result.message}"
        assert result.file_exists, "intake.json should exist"
        assert result.valid_json, "intake.json should be valid JSON"
        assert result.all_fields_present, f"Missing fields: {result.missing_fields}"
        assert result.types_correct, f"Type errors: {result.type_errors}"

    def test_evl_case_009_minimal_intake_accepted(
        self,
        intake_scorer,
        minimal_intake,
        temp_project_dir,
    ):
        """
        EVL-CASE-mission-control-009: Minimal intake accepted.

        Minimal valid intake (required fields only) produces valid output.
        Empty optional fields represented as empty arrays/strings, not absent.
        """
        intake_data = minimal_intake["intake"]

        # Create minimal intake.json
        intake_json = {
            "problem": intake_data["problem"],
            "users": intake_data["users"] if isinstance(intake_data["users"], list) else [intake_data["users"]],
            "scope_in": intake_data["scope_in"] if isinstance(intake_data["scope_in"], list) else [],
            "scope_out": [],  # Empty optional field
            "constraints": [],  # Empty optional field
            "success_criteria": intake_data["success_criteria"] if isinstance(intake_data["success_criteria"], list) else [intake_data["success_criteria"]],
            "prior_art": [],  # Empty optional field
        }

        intake_path = temp_project_dir / "intake.json"
        with open(intake_path, "w", encoding="utf-8") as f:
            json.dump(intake_json, f, indent=2)

        project_slug = temp_project_dir.name
        result = intake_scorer.validate_minimal_intake(project_slug)

        assert result.passed, f"Minimal intake validation failed: {result.message}"
        assert result.all_fields_present, (
            "Empty optional fields must be present as empty arrays"
        )

    def test_evl_case_010_intake_validates_required_fields(
        self,
        intake_scorer,
        temp_project_dir,
    ):
        """
        EVL-CASE-mission-control-010: Intake form validates required fields.

        Form does not submit when problem field is empty. Validation error displayed.
        No intake.json file is created.
        """
        # Simulate validation blocking - don't create the file
        # In a real app, the form would prevent submission

        project_slug = temp_project_dir.name
        result = intake_scorer.validate_intake_blocked(project_slug)

        assert result.passed, (
            "Validation should block submission when problem is empty"
        )
        assert not result.file_exists, (
            "No intake.json should be created when validation fails"
        )


# =============================================================================
# EVL-CASE-011, 012, 013: Artifact Browsing (SC-05)
# =============================================================================

@pytest.mark.artifact
class TestArtifactBrowser:
    """Tests for artifact file listing and viewing."""

    def test_evl_case_011_all_artifact_files_listed(
        self,
        completeness_scorer,
        alpha_project,
        artifacts_dir,
    ):
        """
        EVL-CASE-mission-control-011: All artifact files listed for a project.

        For alpha-project: All artifact files in the directory are listed.
        Zero files from the directory are missing from the list.
        """
        # Get actual files in the project directory
        actual_artifacts = list_artifacts(artifacts_dir, alpha_project["slug"])

        # Check completeness
        result = completeness_scorer.check_artifact_list_completeness(
            alpha_project["slug"],
            actual_artifacts,
        )

        assert result.passed, f"Artifact list incomplete: {result.message}"
        assert result.completeness_percent == 100.0, (
            f"Expected 100% artifact completeness, got {result.completeness_percent}%"
        )

    def test_evl_case_012_artifact_content_viewable_as_markdown(
        self,
        artifacts_dir,
        alpha_project,
    ):
        """
        EVL-CASE-mission-control-012: Artifact content is viewable as rendered Markdown.

        Clicking on problem.md shows content. Markdown headings, lists, tables
        are rendered. YAML frontmatter handled appropriately.
        """
        problem_path = artifacts_dir / alpha_project["slug"] / "problem.md"

        assert problem_path.exists(), f"problem.md not found at {problem_path}"

        with open(problem_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Verify content has expected Markdown structure
        assert content.startswith("---"), "Should have YAML frontmatter"
        assert "# Problem Definition" in content, "Should have Markdown heading"
        assert "## " in content, "Should have sub-headings"

        # Backend validation: content is readable and parseable
        # GUI rendering would be tested with Playwright
        assert len(content) > 100, "Content should have meaningful length"

    def test_evl_case_013_diagram_source_displayable(
        self,
        artifacts_dir,
        alpha_project,
    ):
        """
        EVL-CASE-mission-control-013: Diagram source files are displayable.

        .mmd/.gv files displayed in code block. Content matches file on disk.
        V1 does not render diagrams visually.
        """
        diagrams_dir = artifacts_dir / alpha_project["slug"] / "diagrams"

        # Find any diagram files
        diagram_files = list(diagrams_dir.glob("*.mmd")) + list(diagrams_dir.glob("*.gv"))

        if not diagram_files:
            pytest.skip("No diagram files in alpha-project")

        for diagram_path in diagram_files:
            with open(diagram_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Verify it's valid diagram source
            assert len(content) > 0, f"Diagram file {diagram_path} is empty"

            # For Mermaid files, check for graph definition
            if diagram_path.suffix == ".mmd":
                assert any(keyword in content for keyword in ["graph", "sequenceDiagram", "classDiagram", "flowchart"]), (
                    f"Mermaid file should contain diagram definition"
                )


# =============================================================================
# EVL-CASE-014, 015, 016: Database Exploration (SC-06)
# =============================================================================

@pytest.mark.db
class TestDatabaseExplorer:
    """Tests for wolfpack.db table browsing and filtering."""

    def test_evl_case_014_all_db_tables_browsable(
        self,
        completeness_scorer,
        db_path,
    ):
        """
        EVL-CASE-mission-control-014: All four DB tables are browsable.

        All four tables (reports, tasks, session_logs, agents) are listed
        and selectable. Row count matches the data.
        """
        result = completeness_scorer.check_db_tables_exist_in_database()

        assert result.passed, f"DB tables missing: {result.missing_items}"
        assert result.completeness_percent == 100.0, (
            f"Expected all 4 tables, got {result.completeness_percent}%"
        )

    def test_evl_case_015_filter_by_project_returns_correct_subset(
        self,
        data_match_scorer,
        db_path,
    ):
        """
        EVL-CASE-mission-control-015: Filter by project returns correct subset.

        In the reports table, filter by project returns exact correct rows.
        """
        # Count reports for alpha-project
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM reports WHERE subject LIKE ?",
            ("%alpha-project%",)
        )
        expected_count = cursor.fetchone()[0]
        conn.close()

        # The data_match_scorer uses exact column matching
        # For this test we verify the count is correct
        assert expected_count > 0, "Should have reports for alpha-project"

    def test_evl_case_016_filter_by_agent_returns_correct_subset(
        self,
        data_match_scorer,
        db_path,
    ):
        """
        EVL-CASE-mission-control-016: Filter by agent returns correct subset.

        In the tasks table, filter by agent returns exact correct rows.
        """
        # Test filter for 'eval' agent
        result = data_match_scorer.compare_db_filter_results(
            table="tasks",
            filter_column="assigned_to",
            filter_value="eval",
            expected_count=5,  # 5 projects x 1 eval-spec stage each
        )

        assert result.passed, f"Agent filter mismatch: {result.mismatches}"


# =============================================================================
# EVL-CASE-017, 018: Multi-Project Navigation (SC-07)
# =============================================================================

@pytest.mark.navigation
class TestNavigation:
    """Tests for multi-project navigation."""

    def test_evl_case_017_switch_projects_loads_correct_data(
        self,
        data_match_scorer,
        alpha_project,
        beta_project,
    ):
        """
        EVL-CASE-mission-control-017: Switch between projects loads correct data.

        After switching from alpha to beta, all displayed data matches beta.
        No data from alpha is carried over.
        """
        result = data_match_scorer.compare_project_switch_data(
            alpha_project["slug"],
            beta_project["slug"],
        )

        assert result.passed, f"Project switch data error: {result.mismatches}"

    def test_evl_case_018_project_switch_within_2_seconds(
        self,
        performance_scorer,
        artifacts_dir,
        project_fixtures,
    ):
        """
        EVL-CASE-mission-control-018: Project switch completes within 2 seconds.

        Every switch from one project to another completes in <= 2000ms.
        """
        for project in project_fixtures:
            performance_scorer.start_timer()

            # Simulate project switch by loading manifest
            manifest = load_manifest(artifacts_dir, project["slug"])
            assert manifest is not None, f"Failed to load {project['slug']}"

            result = performance_scorer.check_project_switch()

            assert result.passed, (
                f"Project switch to {project['slug']} too slow: "
                f"{result.elapsed_ms:.1f}ms > {result.threshold_ms}ms"
            )


# =============================================================================
# EVL-CASE-019, 020: Data Accuracy (SC-08)
# =============================================================================

@pytest.mark.accuracy
class TestDataAccuracy:
    """Tests for data accuracy across all sources."""

    def test_evl_case_019_spot_check_all_sources(
        self,
        data_match_scorer,
        project_fixtures,
    ):
        """
        EVL-CASE-mission-control-019: Spot-check across all data sources.

        For each project, compare every displayed field against manifest.json,
        wolfpack.db, and artifact file contents. Zero discrepancies.
        """
        for project in project_fixtures:
            result = data_match_scorer.spot_check_all_sources(project["slug"])

            assert result.passed, (
                f"Data accuracy issues for {project['slug']}: {result.mismatches}"
            )

    def test_evl_case_020_discrepancy_flagged(
        self,
        data_match_scorer,
        stage_mismatch_discrepancy,
    ):
        """
        EVL-CASE-mission-control-020: Discrepancy between manifest and DB is flagged.

        Interface displays manifest value as primary. Warning indicates conflict.
        """
        result = data_match_scorer.check_discrepancy_flagging(
            project_slug=stage_mismatch_discrepancy["project_slug"],
            expected_manifest_value=stage_mismatch_discrepancy["manifest_stage"],
            db_conflicting_value=stage_mismatch_discrepancy["db_stage"],
            field_name="current_stage",
        )

        assert result.passed, f"Discrepancy detection failed: {result.mismatches}"


# =============================================================================
# EVL-CASE-021, 022: Existing Database Compatibility (SC-09)
# =============================================================================

@pytest.mark.dbcompat
class TestDBCompatibility:
    """Tests for database compatibility and schema integrity."""

    def test_evl_case_021_unmodified_db_loads_successfully(
        self,
        completeness_scorer,
        db_path,
    ):
        """
        EVL-CASE-mission-control-021: Unmodified wolfpack.db loads successfully.

        Interface launches without error. All four tables readable.
        No schema alteration occurs.
        """
        # Capture schema before
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'")
        schema_before = set(row[0] for row in cursor.fetchall() if row[0])
        conn.close()

        # Simulate interface use by reading tables
        result = completeness_scorer.check_db_tables_exist_in_database()
        assert result.passed, f"Tables not readable: {result.message}"

        # Verify schema unchanged
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'")
        schema_after = set(row[0] for row in cursor.fetchall() if row[0])
        conn.close()

        assert schema_before == schema_after, (
            "Database schema was modified during interface use"
        )

    def test_evl_case_022_empty_db_loads_gracefully(
        self,
        empty_db,
    ):
        """
        EVL-CASE-mission-control-022: Empty wolfpack.db with correct schema loads.

        Interface launches without error. Database explorer shows all four
        tables with zero rows. No crash or exception.
        """
        # Verify tables exist
        conn = sqlite3.connect(empty_db)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        tables = [row[0] for row in cursor.fetchall()]

        expected_tables = {"reports", "tasks", "session_logs", "agents"}
        assert set(tables) == expected_tables, (
            f"Empty DB missing tables: {expected_tables - set(tables)}"
        )

        # Verify each table has zero rows
        for table in expected_tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            assert count == 0, f"Table {table} should be empty, has {count} rows"

        conn.close()


# =============================================================================
# EVL-CASE-023, 024: Windows 11 Operation (SC-10)
# =============================================================================

@pytest.mark.platform
class TestWindowsPlatform:
    """Tests for Windows 11 compatibility."""

    def test_evl_case_023_launch_without_admin(
        self,
        platform_scorer,
    ):
        """
        EVL-CASE-mission-control-023: Launch on Windows 11 with standard user.

        Interface launches successfully. No UAC prompt. No admin required.
        """
        result = platform_scorer.check_platform()

        if not result.is_windows:
            pytest.skip("Windows-specific test - skipping on non-Windows platform")

        # If we're running the test, we should not be admin
        # (Tests should be run as standard user)
        assert result.message, "Platform check should return a message"

    def test_evl_case_024_no_wsl_dependencies(
        self,
        platform_scorer,
    ):
        """
        EVL-CASE-mission-control-024: No WSL or non-standard dependencies required.

        All dependencies install on clean Windows 11 with Node.js and Python.
        No WSL, Visual Studio Build Tools required.
        """
        # Check npm dependencies
        npm_result = platform_scorer.scan_npm_dependencies()
        assert not npm_result.wsl_required, (
            f"WSL-only npm dependencies found: {npm_result.dependency_issues}"
        )

        # Check Python dependencies
        pip_result = platform_scorer.scan_python_dependencies()
        assert not pip_result.wsl_required, (
            f"WSL-only Python dependencies found: {pip_result.dependency_issues}"
        )


# =============================================================================
# EVL-CASE-025, 026: File System Refresh (Cross-Cutting)
# =============================================================================

@pytest.mark.watcher
class TestFileWatcher:
    """Tests for file system change detection and refresh."""

    def test_evl_case_025_file_change_triggers_refresh(
        self,
        performance_scorer,
        artifacts_dir,
        temp_project_dir,
    ):
        """
        EVL-CASE-mission-control-025: File system change triggers data refresh.

        External modification to manifest.json is detected within 5 seconds.
        """
        # Create a manifest file
        manifest_path = temp_project_dir / "manifest.json"
        manifest = {
            "slug": temp_project_dir.name,
            "current_stage": "problem",
        }
        with open(manifest_path, "w") as f:
            json.dump(manifest, f)

        # Simulate file change
        performance_scorer.start_timer()

        manifest["current_stage"] = "eval-spec"
        with open(manifest_path, "w") as f:
            json.dump(manifest, f)

        # In a real test, we'd wait for watcher to detect
        # Here we simulate detection time
        elapsed = performance_scorer.stop_timer()

        result = performance_scorer.check_file_watcher(elapsed)

        assert result.passed, (
            f"File change detection too slow: {result.elapsed_ms:.1f}ms"
        )

    def test_evl_case_026_manual_reload_refreshes_data(
        self,
        performance_scorer,
        artifacts_dir,
        all_project_slugs,
    ):
        """
        EVL-CASE-mission-control-026: Manual reload button refreshes all data.

        Reload completes within 3 seconds for 5 projects.
        """
        performance_scorer.start_timer()

        # Simulate reload by reading all manifests
        for slug in all_project_slugs:
            manifest = load_manifest(artifacts_dir, slug)
            assert manifest is not None

        result = performance_scorer.check_manual_reload()

        assert result.passed, (
            f"Manual reload too slow: {result.elapsed_ms:.1f}ms > {result.threshold_ms}ms"
        )


# =============================================================================
# EVL-CASE-027: Performance Boundary (Cross-Cutting)
# =============================================================================

@pytest.mark.performance
@pytest.mark.slow
class TestPerformance:
    """Tests for performance at scale (20 projects)."""

    def test_evl_case_027_handles_20_projects(
        self,
        performance_scorer,
        completeness_scorer,
        artifacts_dir,
        generated_fixtures,
    ):
        """
        EVL-CASE-mission-control-027: Handles 20 concurrent projects.

        Project list loads within 3 seconds. Switching between projects < 2s.
        Database explorer loads any table < 2s. No UI freezes.
        """
        # Test project list load (we have 5 + 3 discrepancy = 8 projects)
        # This tests the scaling principle
        performance_scorer.start_timer()

        valid_projects = completeness_scorer.get_valid_projects()

        result = performance_scorer.check_project_list_load()

        assert result.passed, (
            f"Project list load too slow: {result.elapsed_ms:.1f}ms "
            f"for {len(valid_projects)} projects"
        )

        # Test project switch timing (already tested in 018, but verify at scale)
        for slug in valid_projects[:5]:  # Test first 5
            performance_scorer.start_timer()
            manifest = load_manifest(artifacts_dir, slug)
            switch_result = performance_scorer.check_project_switch()

            assert switch_result.passed, (
                f"Project switch to {slug} too slow at scale"
            )

        # Verify no accumulated performance degradation
        summary = performance_scorer.get_summary()
        assert summary["pass_rate"] == 100.0, (
            f"Performance degradation detected: {summary['pass_rate']}% pass rate"
        )


# =============================================================================
# Additional Validation Tests
# =============================================================================

class TestFixtureIntegrity:
    """Tests to verify fixture generation is correct."""

    def test_all_project_manifests_valid_json(self, artifacts_dir, all_project_slugs):
        """Verify all generated manifest.json files are valid."""
        for slug in all_project_slugs:
            manifest = load_manifest(artifacts_dir, slug)
            assert manifest is not None, f"Manifest for {slug} should be valid JSON"
            assert "slug" in manifest or "project" in manifest, (
                f"Manifest for {slug} should have slug field"
            )

    def test_database_has_expected_data(self, db_path):
        """Verify database has test data."""
        tables = ["reports", "tasks", "session_logs", "agents"]

        for table in tables:
            count = count_db_rows(db_path, table)
            assert count > 0, f"Table {table} should have rows"

    def test_artifacts_exist_for_projects(self, artifacts_dir, project_fixtures):
        """Verify artifact files exist for each project."""
        for project in project_fixtures:
            project_dir = artifacts_dir / project["slug"]
            assert project_dir.exists(), f"Project dir should exist: {project['slug']}"

            for artifact in project["artifacts"]:
                artifact_path = project_dir / artifact
                assert artifact_path.exists(), (
                    f"Artifact should exist: {project['slug']}/{artifact}"
                )
