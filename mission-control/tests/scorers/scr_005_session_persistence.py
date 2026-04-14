"""
SCR-mission-control-005 - Session Persistence Checker

Type: algorithmic
Applies to: EVL-CASE-mission-control-001, 002

Check:
1. Capture a snapshot of all displayed project data before closing
2. Close and reopen the interface
3. Capture the same snapshot after reopen
4. Compare the two snapshots for equality
5. Check that no file-load dialogs, error modals, or empty-state screens are present

Pass condition: Snapshots are identical. Zero modal dialogs or error states detected.

Note: For V1 backend validation, we simulate this by verifying data sources
(manifest.json, wolfpack.db) maintain integrity and can be re-read correctly.
"""

import hashlib
import json
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class SessionSnapshot:
    """Snapshot of session state for comparison."""

    projects: List[Dict[str, Any]] = field(default_factory=list)
    project_count: int = 0
    db_hash: Optional[str] = None
    manifest_hashes: Dict[str, str] = field(default_factory=dict)
    timestamp: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert snapshot to dictionary for serialization."""
        return {
            "projects": self.projects,
            "project_count": self.project_count,
            "db_hash": self.db_hash,
            "manifest_hashes": self.manifest_hashes,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionSnapshot":
        """Create snapshot from dictionary."""
        return cls(
            projects=data.get("projects", []),
            project_count=data.get("project_count", 0),
            db_hash=data.get("db_hash"),
            manifest_hashes=data.get("manifest_hashes", {}),
            timestamp=data.get("timestamp", ""),
        )


@dataclass
class PersistenceResult:
    """Result of session persistence check."""

    passed: bool
    snapshot_match: bool = False
    error_states_found: bool = False
    load_prompts_found: bool = False
    differences: List[str] = field(default_factory=list)
    message: str = ""


class SessionPersistenceScorer:
    """
    Scorer that verifies session state persists across close/reopen.

    For V1 backend validation:
    - Verifies manifest.json files are unchanged between reads
    - Verifies wolfpack.db data is unchanged
    - Simulates "reopen" by re-reading all data sources
    """

    def __init__(self, artifacts_dir: Path, db_path: Optional[Path] = None):
        """
        Initialize the Session Persistence Scorer.

        Args:
            artifacts_dir: Path to artifacts directory
            db_path: Optional path to wolfpack.db
        """
        self.artifacts_dir = artifacts_dir
        self.db_path = db_path

    def _compute_file_hash(self, file_path: Path) -> Optional[str]:
        """Compute MD5 hash of a file for comparison."""
        if not file_path.exists():
            return None
        try:
            with open(file_path, "rb") as f:
                return hashlib.md5(f.read()).hexdigest()
        except IOError:
            return None

    def _compute_db_hash(self) -> Optional[str]:
        """Compute a hash representing database state."""
        if not self.db_path or not self.db_path.exists():
            return None

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Get counts from all tables
            tables = ["reports", "tasks", "session_logs", "agents"]
            counts = []
            for table in tables:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    counts.append(str(cursor.fetchone()[0]))
                except sqlite3.Error:
                    counts.append("0")

            conn.close()

            # Create a simple hash from counts
            count_str = "|".join(counts)
            return hashlib.md5(count_str.encode()).hexdigest()
        except sqlite3.Error:
            return None

    def capture_snapshot(self) -> SessionSnapshot:
        """
        Capture current state snapshot.

        Returns:
            SessionSnapshot with current state data
        """
        from datetime import datetime

        snapshot = SessionSnapshot()
        snapshot.timestamp = datetime.now().isoformat()

        # Capture manifest hashes
        if self.artifacts_dir.exists():
            for project_dir in self.artifacts_dir.iterdir():
                if project_dir.is_dir():
                    manifest_path = project_dir / "manifest.json"
                    if manifest_path.exists():
                        file_hash = self._compute_file_hash(manifest_path)
                        if file_hash:
                            snapshot.manifest_hashes[project_dir.name] = file_hash

                        # Load project data
                        try:
                            with open(manifest_path, "r", encoding="utf-8") as f:
                                manifest = json.load(f)
                            snapshot.projects.append({
                                "slug": manifest.get("slug") or project_dir.name,
                                "title": manifest.get("title", ""),
                                "current_stage": manifest.get("current_stage", ""),
                                "status": manifest.get("status", ""),
                                "priority": manifest.get("priority", 0),
                            })
                        except (json.JSONDecodeError, IOError):
                            pass

        snapshot.project_count = len(snapshot.projects)

        # Capture DB hash
        snapshot.db_hash = self._compute_db_hash()

        return snapshot

    def compare_snapshots(
        self,
        before: SessionSnapshot,
        after: SessionSnapshot,
    ) -> PersistenceResult:
        """
        Compare two snapshots to verify persistence.

        Args:
            before: Snapshot taken before close
            after: Snapshot taken after reopen

        Returns:
            PersistenceResult with comparison details
        """
        result = PersistenceResult(passed=True)
        result.differences = []

        # Compare project counts
        if before.project_count != after.project_count:
            result.differences.append(
                f"Project count changed: {before.project_count} -> {after.project_count}"
            )

        # Compare manifest hashes
        all_slugs = set(before.manifest_hashes.keys()) | set(after.manifest_hashes.keys())
        for slug in all_slugs:
            before_hash = before.manifest_hashes.get(slug)
            after_hash = after.manifest_hashes.get(slug)

            if before_hash != after_hash:
                if before_hash is None:
                    result.differences.append(f"Project '{slug}' appeared after reopen")
                elif after_hash is None:
                    result.differences.append(f"Project '{slug}' missing after reopen")
                else:
                    result.differences.append(f"Project '{slug}' manifest changed")

        # Compare DB hash
        if before.db_hash != after.db_hash:
            result.differences.append("Database state changed between snapshots")

        # Compare project data
        before_projects = {p["slug"]: p for p in before.projects}
        after_projects = {p["slug"]: p for p in after.projects}

        for slug in set(before_projects.keys()) | set(after_projects.keys()):
            before_data = before_projects.get(slug)
            after_data = after_projects.get(slug)

            if before_data != after_data:
                if before_data is None:
                    result.differences.append(f"Project '{slug}' data appeared after reopen")
                elif after_data is None:
                    result.differences.append(f"Project '{slug}' data missing after reopen")
                else:
                    for key in ["title", "current_stage", "status", "priority"]:
                        if before_data.get(key) != after_data.get(key):
                            result.differences.append(
                                f"Project '{slug}' {key} changed: "
                                f"{before_data.get(key)!r} -> {after_data.get(key)!r}"
                            )

        result.snapshot_match = len(result.differences) == 0
        result.passed = result.snapshot_match

        if result.passed:
            result.message = "Session persistence verified: all data identical after reopen"
        else:
            result.message = f"Session persistence failed: {len(result.differences)} differences found"

        return result

    def check_persistence(self) -> PersistenceResult:
        """
        Perform full persistence check (capture, simulate reopen, compare).

        EVL-CASE-001: State persists across close/reopen
        EVL-CASE-002: No manual recovery required

        Returns:
            PersistenceResult with check details
        """
        # Capture "before" state
        before = self.capture_snapshot()

        # Simulate "close" by clearing any cached state
        # (In a real test, we'd close and reopen the app)

        # Capture "after" state (simulating reopen by re-reading)
        after = self.capture_snapshot()

        # Compare
        result = self.compare_snapshots(before, after)

        return result

    def verify_data_readable(self) -> PersistenceResult:
        """
        Verify all data sources can be read without errors.

        This simulates checking for:
        - No file-load prompts needed
        - No error dialogs
        - No empty states

        Returns:
            PersistenceResult with readability check details
        """
        result = PersistenceResult(passed=True)
        result.error_states_found = False
        result.load_prompts_found = False

        errors = []

        # Check artifacts directory
        if not self.artifacts_dir.exists():
            errors.append(f"Artifacts directory not found: {self.artifacts_dir}")

        # Check each project manifest is readable
        if self.artifacts_dir.exists():
            project_count = 0
            for project_dir in self.artifacts_dir.iterdir():
                if project_dir.is_dir():
                    manifest_path = project_dir / "manifest.json"
                    if manifest_path.exists():
                        try:
                            with open(manifest_path, "r", encoding="utf-8") as f:
                                json.load(f)
                            project_count += 1
                        except (json.JSONDecodeError, IOError) as e:
                            errors.append(f"Cannot read {manifest_path}: {e}")

            if project_count == 0:
                errors.append("No valid projects found - would show empty state")

        # Check database is readable
        if self.db_path:
            if not self.db_path.exists():
                errors.append(f"Database not found: {self.db_path}")
            else:
                try:
                    conn = sqlite3.connect(self.db_path)
                    cursor = conn.cursor()
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                    tables = cursor.fetchall()
                    conn.close()

                    if len(tables) == 0:
                        errors.append("Database has no tables - would show error")
                except sqlite3.Error as e:
                    errors.append(f"Cannot read database: {e}")

        if errors:
            result.passed = False
            result.error_states_found = True
            result.differences = errors
            result.message = f"Data readability issues: {len(errors)} errors"
        else:
            result.message = "All data sources readable without errors"

        return result

    def save_snapshot(self, snapshot: SessionSnapshot, file_path: Path) -> None:
        """Save snapshot to file for later comparison."""
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(snapshot.to_dict(), f, indent=2)

    def load_snapshot(self, file_path: Path) -> Optional[SessionSnapshot]:
        """Load snapshot from file."""
        if not file_path.exists():
            return None
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return SessionSnapshot.from_dict(data)
        except (json.JSONDecodeError, IOError):
            return None
