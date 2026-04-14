"""
Wolf Pack Mission Control V1 - Pytest Configuration

Common fixtures and configuration for the eval harness test suite.
"""

import json
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

import pytest

# Add tests directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from fixtures.generate_fixtures import (
    DEFAULT_DB_NAME,
    DEFAULT_OUTPUT_DIR,
    DISCREPANCY_FIXTURES,
    INTAKE_FIXTURES,
    PIPELINE_STAGES,
    PROJECT_FIXTURES,
    cleanup_fixtures,
    create_database_schema,
    generate_all_fixtures,
    generate_discrepancy_fixtures,
    generate_intake_fixtures,
    generate_project_fixtures,
    populate_database,
)

from scorers import (
    CompletenessScorer,
    DataMatchScorer,
    IntakeOutputScorer,
    PerformanceScorer,
    PlatformScorer,
    SessionPersistenceScorer,
)


# ---------------------------------------------------------------------------
# Pytest Markers Configuration
# ---------------------------------------------------------------------------

def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "session: Session continuity tests (EVL-CASE-001, 002)")
    config.addinivalue_line("markers", "project: Project listing tests (EVL-CASE-003, 004)")
    config.addinivalue_line("markers", "pipeline: Pipeline display tests (EVL-CASE-005, 006, 007)")
    config.addinivalue_line("markers", "intake: Intake form tests (EVL-CASE-008, 009, 010)")
    config.addinivalue_line("markers", "artifact: Artifact browser tests (EVL-CASE-011, 012, 013)")
    config.addinivalue_line("markers", "db: Database explorer tests (EVL-CASE-014, 015, 016)")
    config.addinivalue_line("markers", "navigation: Navigation tests (EVL-CASE-017, 018)")
    config.addinivalue_line("markers", "accuracy: Data accuracy tests (EVL-CASE-019, 020)")
    config.addinivalue_line("markers", "dbcompat: DB compatibility tests (EVL-CASE-021, 022)")
    config.addinivalue_line("markers", "platform: Windows platform tests (EVL-CASE-023, 024)")
    config.addinivalue_line("markers", "watcher: File watcher tests (EVL-CASE-025, 026)")
    config.addinivalue_line("markers", "performance: Performance/scale tests (EVL-CASE-027)")
    config.addinivalue_line("markers", "slow: Tests that may take longer to run")


# ---------------------------------------------------------------------------
# Fixture Directory Management
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def fixtures_base_dir() -> Generator[Path, None, None]:
    """
    Session-scoped fixture directory.

    Creates a temporary directory for test fixtures that persists
    across all tests in the session.
    """
    # Use a temp directory within the tests folder for easier debugging
    fixtures_dir = Path(__file__).parent / "fixtures" / "generated"
    fixtures_dir.mkdir(parents=True, exist_ok=True)

    yield fixtures_dir

    # Cleanup after session (optional - comment out for debugging)
    # if fixtures_dir.exists():
    #     shutil.rmtree(fixtures_dir)


@pytest.fixture(scope="session")
def generated_fixtures(fixtures_base_dir: Path) -> Dict[str, Any]:
    """
    Generate all test fixtures once per session.

    Returns:
        Summary dict with paths to all generated fixtures
    """
    # Clean and regenerate fixtures
    if fixtures_base_dir.exists():
        shutil.rmtree(fixtures_base_dir)

    summary = generate_all_fixtures(fixtures_base_dir)
    return summary


@pytest.fixture(scope="session")
def artifacts_dir(generated_fixtures: Dict[str, Any]) -> Path:
    """Path to the generated artifacts directory."""
    return Path(generated_fixtures["output_dir"]) / "artifacts"


@pytest.fixture(scope="session")
def db_path(generated_fixtures: Dict[str, Any]) -> Path:
    """Path to the generated wolfpack.db."""
    return Path(generated_fixtures["database_path"])


# ---------------------------------------------------------------------------
# Project Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def project_fixtures() -> List[Dict[str, Any]]:
    """Return the project fixture definitions (DS-mission-control-001)."""
    return PROJECT_FIXTURES


@pytest.fixture(scope="session")
def all_project_slugs(project_fixtures: List[Dict[str, Any]], discrepancy_fixtures: List[Dict[str, Any]]) -> List[str]:
    """Return all project slugs from the fixtures (including discrepancy projects)."""
    main_slugs = [p["slug"] for p in project_fixtures]
    discrepancy_slugs = [d["project_slug"] for d in discrepancy_fixtures]
    return main_slugs + discrepancy_slugs


@pytest.fixture(scope="session")
def main_project_slugs(project_fixtures: List[Dict[str, Any]]) -> List[str]:
    """Return only the 5 main project slugs (excluding discrepancy projects)."""
    return [p["slug"] for p in project_fixtures]


@pytest.fixture(scope="session")
def alpha_project(project_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """FIX-001: Complete pipeline project (all stages passed)."""
    return next(p for p in project_fixtures if p["fixture_id"] == "FIX-001")


@pytest.fixture(scope="session")
def beta_project(project_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """FIX-002: Mid-pipeline project (G1 passed, G2 pending)."""
    return next(p for p in project_fixtures if p["fixture_id"] == "FIX-002")


@pytest.fixture(scope="session")
def gamma_project(project_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """FIX-003: Gate retry project (G1 passed after 2 attempts)."""
    return next(p for p in project_fixtures if p["fixture_id"] == "FIX-003")


@pytest.fixture(scope="session")
def delta_project(project_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """FIX-004: PRD stage project."""
    return next(p for p in project_fixtures if p["fixture_id"] == "FIX-004")


@pytest.fixture(scope="session")
def epsilon_project(project_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """FIX-005: Fresh project (no gate attempts)."""
    return next(p for p in project_fixtures if p["fixture_id"] == "FIX-005")


# ---------------------------------------------------------------------------
# Intake Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def intake_fixtures() -> List[Dict[str, Any]]:
    """Return the intake fixture definitions (DS-mission-control-002)."""
    return INTAKE_FIXTURES


@pytest.fixture(scope="session")
def complete_intake(intake_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """INTAKE-001: All six fields fully populated."""
    return next(i for i in intake_fixtures if i["case_id"] == "INTAKE-001")


@pytest.fixture(scope="session")
def minimal_intake(intake_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """INTAKE-002: Minimal valid intake."""
    return next(i for i in intake_fixtures if i["case_id"] == "INTAKE-002")


@pytest.fixture(scope="session")
def no_constraints_intake(intake_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """INTAKE-003: All fields populated, constraints/prior_art = none."""
    return next(i for i in intake_fixtures if i["case_id"] == "INTAKE-003")


# ---------------------------------------------------------------------------
# Discrepancy Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def discrepancy_fixtures() -> List[Dict[str, Any]]:
    """Return the discrepancy fixture definitions (DS-mission-control-003)."""
    return DISCREPANCY_FIXTURES


@pytest.fixture(scope="session")
def stage_mismatch_discrepancy(discrepancy_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """DISC-001: Manifest says eval-spec, DB says prd."""
    return next(d for d in discrepancy_fixtures if d["case_id"] == "DISC-001")


@pytest.fixture(scope="session")
def agent_mismatch_discrepancy(discrepancy_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """DISC-002: Manifest says framer, DB says quill."""
    return next(d for d in discrepancy_fixtures if d["case_id"] == "DISC-002")


@pytest.fixture(scope="session")
def missing_audit_discrepancy(discrepancy_fixtures: List[Dict[str, Any]]) -> Dict[str, Any]:
    """DISC-003: Manifest says passed, DB has no gate log."""
    return next(d for d in discrepancy_fixtures if d["case_id"] == "DISC-003")


# ---------------------------------------------------------------------------
# Scorer Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def data_match_scorer(artifacts_dir: Path, db_path: Path) -> Generator[DataMatchScorer, None, None]:
    """Data match scorer instance."""
    scorer = DataMatchScorer(artifacts_dir, db_path)
    yield scorer
    scorer.close()


@pytest.fixture
def completeness_scorer(artifacts_dir: Path, db_path: Path) -> Generator[CompletenessScorer, None, None]:
    """Completeness scorer instance."""
    scorer = CompletenessScorer(artifacts_dir, db_path)
    yield scorer
    scorer.close()


@pytest.fixture
def performance_scorer() -> PerformanceScorer:
    """Performance scorer instance."""
    return PerformanceScorer()


@pytest.fixture
def intake_scorer(artifacts_dir: Path) -> IntakeOutputScorer:
    """Intake output scorer instance."""
    return IntakeOutputScorer(artifacts_dir)


@pytest.fixture
def session_scorer(artifacts_dir: Path, db_path: Path) -> SessionPersistenceScorer:
    """Session persistence scorer instance."""
    return SessionPersistenceScorer(artifacts_dir, db_path)


@pytest.fixture
def platform_scorer() -> PlatformScorer:
    """Platform compatibility scorer instance."""
    project_root = Path(__file__).parent.parent
    return PlatformScorer(project_root)


# ---------------------------------------------------------------------------
# Database Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db_connection(db_path: Path) -> Generator[sqlite3.Connection, None, None]:
    """SQLite connection to the test database."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()


@pytest.fixture
def empty_db() -> Generator[Path, None, None]:
    """Create an empty database with correct schema but no rows."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "empty_wolfpack.db"
        conn = create_database_schema(db_path)
        conn.close()
        yield db_path


# ---------------------------------------------------------------------------
# Utility Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def pipeline_stages() -> List[str]:
    """Return the list of pipeline stage names."""
    return PIPELINE_STAGES


@pytest.fixture
def temp_project_dir(artifacts_dir: Path) -> Generator[Path, None, None]:
    """Create a temporary project directory for testing."""
    import uuid
    project_slug = f"temp-test-{uuid.uuid4().hex[:8]}"
    project_dir = artifacts_dir / project_slug
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "diagrams").mkdir(exist_ok=True)

    yield project_dir

    # Cleanup
    if project_dir.exists():
        shutil.rmtree(project_dir)


# ---------------------------------------------------------------------------
# Helper Functions (available in tests)
# ---------------------------------------------------------------------------

def load_manifest(artifacts_dir: Path, project_slug: str) -> Optional[Dict[str, Any]]:
    """Load manifest.json for a project."""
    manifest_path = artifacts_dir / project_slug / "manifest.json"
    if not manifest_path.exists():
        return None
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def list_artifacts(artifacts_dir: Path, project_slug: str) -> List[str]:
    """List all artifact files in a project directory."""
    project_dir = artifacts_dir / project_slug
    if not project_dir.exists():
        return []

    files = []
    for file_path in project_dir.rglob("*"):
        if file_path.is_file():
            # Normalize to forward slashes for cross-platform consistency
            rel_path = file_path.relative_to(project_dir).as_posix()
            files.append(rel_path)
    return files


def count_db_rows(db_path: Path, table: str) -> int:
    """Count rows in a database table."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    count = cursor.fetchone()[0]
    conn.close()
    return count
