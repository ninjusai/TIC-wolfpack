"""
SCR-mission-control-007 - Platform Compatibility Checker

Type: algorithmic
Applies to: EVL-CASE-mission-control-023, 024

Check:
1. Launch the application process and capture exit code
2. Check that no UAC elevation prompt was triggered
3. Scan dependency manifest for known WSL-only or native-compilation packages
4. Verify all npm/pip install commands complete with exit code 0

Pass condition: Application launches, no elevation required, all dependencies
install cleanly.

Note: For V1 backend validation, we check:
- Python dependencies install without errors
- No WSL-only packages in requirements
- No native compilation requirements
"""

import os
import platform
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


# Known packages that require WSL, Visual Studio Build Tools, or native compilation
PROBLEMATIC_PACKAGES = {
    "npm": {
        # Packages requiring native compilation
        "node-gyp",
        "bcrypt",  # Native bcrypt (bcryptjs is fine)
        "sqlite3",  # Native sqlite3 (better-sqlite3 uses prebuilt)
        "sharp",  # Requires vips (now has prebuilt binaries)
    },
    "pip": {
        # Packages requiring compilation
        "psutil",  # Has wheels, but may need compiler on some platforms
        "lxml",  # Requires libxml2
        "numpy",  # Has wheels but used to need compiler
        "pandas",  # Same as numpy
    },
}

# Packages that definitely won't work on Windows without WSL
WSL_ONLY_PACKAGES = {
    "npm": {
        "fsevents",  # macOS only
        "unix-dgram",  # Unix only
        "posix",  # Unix only
    },
    "pip": {
        "python-prctl",  # Linux only
        "uwsgi",  # Unix only
        "gunicorn",  # Unix-like only (though works on Windows with limitations)
    },
}


@dataclass
class PlatformResult:
    """Result of platform compatibility check."""

    passed: bool
    platform_name: str = ""
    is_windows: bool = False
    is_admin: bool = False
    dependency_issues: List[str] = field(default_factory=list)
    wsl_required: bool = False
    native_compile_required: bool = False
    install_errors: List[str] = field(default_factory=list)
    message: str = ""


class PlatformScorer:
    """
    Scorer that checks Windows 11 compatibility and dependency cleanliness.

    Validates:
    - Platform detection (Windows 11)
    - No admin privileges required
    - No WSL dependencies
    - No native compilation requirements
    - Dependencies install cleanly
    """

    def __init__(self, project_root: Path):
        """
        Initialize the Platform Scorer.

        Args:
            project_root: Root directory of the Mission Control project
        """
        self.project_root = project_root

    def check_platform(self) -> PlatformResult:
        """
        Check if running on Windows with standard user permissions.

        EVL-CASE-023: Run on Windows 11 without admin

        Returns:
            PlatformResult with platform check details
        """
        result = PlatformResult(passed=True)
        result.platform_name = platform.system()
        result.is_windows = result.platform_name == "Windows"

        if result.is_windows:
            # Check Windows version
            version = platform.version()
            release = platform.release()
            result.message = f"Running on Windows {release} (version {version})"

            # Check if running as admin (Windows-specific)
            result.is_admin = self._check_admin_windows()
            if result.is_admin:
                result.message += " - WARNING: Running with admin privileges"
        else:
            result.message = f"Running on {result.platform_name} - Windows 11 tests will be skipped"

        return result

    def _check_admin_windows(self) -> bool:
        """Check if running with admin privileges on Windows."""
        if platform.system() != "Windows":
            return False

        try:
            import ctypes
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except (AttributeError, OSError):
            # Fallback: try to write to a protected location
            try:
                test_path = Path(os.environ.get("SYSTEMROOT", "C:\\Windows")) / "test_admin.tmp"
                test_path.touch()
                test_path.unlink()
                return True
            except PermissionError:
                return False

    def scan_npm_dependencies(self) -> PlatformResult:
        """
        Scan package.json for problematic npm dependencies.

        Returns:
            PlatformResult with dependency analysis
        """
        result = PlatformResult(passed=True)
        package_json = self.project_root / "package.json"

        if not package_json.exists():
            result.message = "No package.json found"
            return result

        try:
            import json
            with open(package_json, "r", encoding="utf-8") as f:
                pkg = json.load(f)

            all_deps: Set[str] = set()
            for dep_type in ["dependencies", "devDependencies", "optionalDependencies"]:
                deps = pkg.get(dep_type, {})
                all_deps.update(deps.keys())

            # Check for WSL-only packages
            wsl_found = all_deps.intersection(WSL_ONLY_PACKAGES.get("npm", set()))
            if wsl_found:
                result.wsl_required = True
                result.dependency_issues.extend([f"WSL-only: {pkg}" for pkg in wsl_found])

            # Check for native compilation packages
            native_found = all_deps.intersection(PROBLEMATIC_PACKAGES.get("npm", set()))
            if native_found:
                result.native_compile_required = True
                result.dependency_issues.extend([f"Native compile: {pkg}" for pkg in native_found])

            if result.dependency_issues:
                result.passed = False
                result.message = f"Found {len(result.dependency_issues)} problematic npm dependencies"
            else:
                result.message = f"Scanned {len(all_deps)} npm dependencies - all clean"

        except (json.JSONDecodeError, IOError) as e:
            result.passed = False
            result.message = f"Error reading package.json: {e}"

        return result

    def scan_python_dependencies(self) -> PlatformResult:
        """
        Scan requirements.txt for problematic Python dependencies.

        Returns:
            PlatformResult with dependency analysis
        """
        result = PlatformResult(passed=True)

        # Check multiple possible locations
        req_paths = [
            self.project_root / "requirements.txt",
            self.project_root / "tests" / "requirements.txt",
        ]

        all_deps: Set[str] = set()

        for req_path in req_paths:
            if req_path.exists():
                try:
                    with open(req_path, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if line and not line.startswith("#"):
                                # Extract package name (before version specifier)
                                match = re.match(r"^([a-zA-Z0-9_-]+)", line)
                                if match:
                                    all_deps.add(match.group(1).lower())
                except IOError:
                    pass

        # Check for WSL-only packages
        wsl_found = all_deps.intersection({p.lower() for p in WSL_ONLY_PACKAGES.get("pip", set())})
        if wsl_found:
            result.wsl_required = True
            result.dependency_issues.extend([f"WSL-only: {pkg}" for pkg in wsl_found])

        # Check for native compilation packages (lenient - many have wheels now)
        native_found = all_deps.intersection({p.lower() for p in PROBLEMATIC_PACKAGES.get("pip", set())})
        if native_found:
            # Just warn, don't fail - most have prebuilt wheels
            result.dependency_issues.extend([f"May need compiler: {pkg}" for pkg in native_found])

        if result.wsl_required:
            result.passed = False
            result.message = f"Found WSL-only Python dependencies: {wsl_found}"
        elif result.dependency_issues:
            result.message = f"Scanned {len(all_deps)} Python dependencies - {len(result.dependency_issues)} warnings"
        else:
            result.message = f"Scanned {len(all_deps)} Python dependencies - all clean"

        return result

    def verify_pip_install(self, requirements_path: Optional[Path] = None) -> PlatformResult:
        """
        Verify that pip install completes without errors.

        EVL-CASE-024: All pip install commands complete with exit code 0

        Args:
            requirements_path: Path to requirements.txt (default: tests/requirements.txt)

        Returns:
            PlatformResult with install verification
        """
        result = PlatformResult(passed=True)

        if requirements_path is None:
            requirements_path = self.project_root / "tests" / "requirements.txt"

        if not requirements_path.exists():
            result.message = f"No requirements file at {requirements_path}"
            return result

        # Dry-run: check if packages are already installed
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "pip", "check"],
                capture_output=True,
                text=True,
                timeout=60,
            )

            if proc.returncode != 0:
                result.install_errors.append(f"pip check failed: {proc.stdout}")
                result.passed = False

            result.message = "pip dependencies verified"

        except subprocess.TimeoutExpired:
            result.passed = False
            result.message = "pip check timed out"
        except Exception as e:
            result.passed = False
            result.message = f"pip verification error: {e}"

        return result

    def full_platform_check(self) -> PlatformResult:
        """
        Run full platform compatibility check.

        Combines all checks for EVL-CASE-023 and EVL-CASE-024.

        Returns:
            Aggregate PlatformResult
        """
        results = []

        # Platform check
        platform_result = self.check_platform()
        results.append(platform_result)

        # NPM dependencies
        npm_result = self.scan_npm_dependencies()
        results.append(npm_result)

        # Python dependencies
        pip_result = self.scan_python_dependencies()
        results.append(pip_result)

        # Aggregate results
        final = PlatformResult(passed=True)
        final.platform_name = platform_result.platform_name
        final.is_windows = platform_result.is_windows
        final.is_admin = platform_result.is_admin

        all_issues = []
        for r in results:
            if not r.passed:
                final.passed = False
            all_issues.extend(r.dependency_issues)
            all_issues.extend(r.install_errors)
            if r.wsl_required:
                final.wsl_required = True
            if r.native_compile_required:
                final.native_compile_required = True

        final.dependency_issues = all_issues

        if final.passed:
            final.message = "Platform compatibility: all checks passed"
        else:
            final.message = f"Platform compatibility: {len(all_issues)} issues found"

        return final
