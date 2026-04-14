"""
SCR-mission-control-004 - File Output Validator (Intake)

Type: algorithmic
Applies to: EVL-CASE-mission-control-008, 009, 010

Check:
1. Verify artifacts/{project}/intake.json exists
2. Parse as JSON (must not throw)
3. Validate all six fields are present as keys
4. Validate field types match schema
5. Compare field values to what was entered

Pass condition: All five checks pass.
For EVL-CASE-010 (validation failure): file must NOT exist and UI must
display a validation error element.

Intake JSON Schema:
- problem: string
- users: string[]
- scope_in: string[]
- scope_out: string[]
- constraints: string[]
- success_criteria: string[]
- prior_art: string[]
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


@dataclass
class IntakeValidationResult:
    """Result of intake output validation."""

    passed: bool
    file_exists: bool = False
    valid_json: bool = False
    all_fields_present: bool = False
    types_correct: bool = False
    values_match: bool = False
    missing_fields: List[str] = field(default_factory=list)
    type_errors: List[str] = field(default_factory=list)
    value_mismatches: List[str] = field(default_factory=list)
    message: str = ""


# Schema definition for intake.json
INTAKE_SCHEMA = {
    "problem": str,
    "users": list,  # string[]
    "scope_in": list,  # string[]
    "scope_out": list,  # string[]
    "constraints": list,  # string[] (can be empty or contain "none")
    "success_criteria": list,  # string[]
    "prior_art": list,  # string[] (can be empty or contain "none")
}

# Required fields that must be non-empty for validation
REQUIRED_FIELDS = ["problem"]


class IntakeOutputScorer:
    """
    Scorer that validates intake form output against expected schema.

    Validates:
    - File existence
    - JSON validity
    - Field presence
    - Field types
    - Field values (when expected values provided)
    """

    def __init__(self, artifacts_dir: Path):
        """
        Initialize the Intake Output Scorer.

        Args:
            artifacts_dir: Path to the artifacts directory
        """
        self.artifacts_dir = artifacts_dir

    def get_intake_path(self, project_slug: str) -> Path:
        """Get the expected path to intake.json for a project."""
        return self.artifacts_dir / project_slug / "intake.json"

    def validate_intake_output(
        self,
        project_slug: str,
        expected_values: Optional[Dict[str, Any]] = None,
    ) -> IntakeValidationResult:
        """
        Validate intake.json for a project.

        EVL-CASE-008: Complete intake produces valid output
        EVL-CASE-009: Minimal intake accepted

        Args:
            project_slug: Project identifier
            expected_values: Optional dict of expected field values

        Returns:
            IntakeValidationResult with validation details
        """
        result = IntakeValidationResult(passed=True)
        intake_path = self.get_intake_path(project_slug)

        # Check 1: File exists
        result.file_exists = intake_path.exists()
        if not result.file_exists:
            result.passed = False
            result.message = f"intake.json not found at {intake_path}"
            return result

        # Check 2: Valid JSON
        try:
            with open(intake_path, "r", encoding="utf-8") as f:
                intake_data = json.load(f)
            result.valid_json = True
        except (json.JSONDecodeError, IOError) as e:
            result.passed = False
            result.valid_json = False
            result.message = f"Invalid JSON: {e}"
            return result

        # Check 3: All fields present
        result.missing_fields = []
        for field_name in INTAKE_SCHEMA:
            if field_name not in intake_data:
                result.missing_fields.append(field_name)

        result.all_fields_present = len(result.missing_fields) == 0
        if not result.all_fields_present:
            result.passed = False
            result.message = f"Missing fields: {result.missing_fields}"
            return result

        # Check 4: Field types correct
        result.type_errors = []
        for field_name, expected_type in INTAKE_SCHEMA.items():
            actual_value = intake_data.get(field_name)

            if expected_type == str:
                if not isinstance(actual_value, str):
                    result.type_errors.append(
                        f"{field_name}: expected string, got {type(actual_value).__name__}"
                    )
            elif expected_type == list:
                if not isinstance(actual_value, list):
                    result.type_errors.append(
                        f"{field_name}: expected array, got {type(actual_value).__name__}"
                    )
                elif actual_value:  # Non-empty list - check element types
                    for i, item in enumerate(actual_value):
                        if not isinstance(item, str):
                            result.type_errors.append(
                                f"{field_name}[{i}]: expected string, got {type(item).__name__}"
                            )

        result.types_correct = len(result.type_errors) == 0
        if not result.types_correct:
            result.passed = False
            result.message = f"Type errors: {result.type_errors}"
            return result

        # Check 5: Values match (if expected values provided)
        if expected_values:
            result.value_mismatches = []
            for field_name, expected_value in expected_values.items():
                if field_name not in intake_data:
                    continue

                actual_value = intake_data[field_name]

                # Normalize comparison for lists
                if isinstance(expected_value, list) and isinstance(actual_value, list):
                    if set(expected_value) != set(actual_value):
                        result.value_mismatches.append(
                            f"{field_name}: expected {expected_value}, got {actual_value}"
                        )
                elif expected_value != actual_value:
                    result.value_mismatches.append(
                        f"{field_name}: expected {expected_value!r}, got {actual_value!r}"
                    )

            result.values_match = len(result.value_mismatches) == 0
            if not result.values_match:
                result.passed = False
                result.message = f"Value mismatches: {result.value_mismatches}"
                return result
        else:
            result.values_match = True  # No expected values to check

        result.message = "Intake validation passed: all checks successful"
        return result

    def validate_intake_blocked(
        self,
        project_slug: str,
    ) -> IntakeValidationResult:
        """
        Validate that intake was blocked (file should NOT exist).

        EVL-CASE-010: Intake validation blocks incomplete submissions

        Args:
            project_slug: Project identifier

        Returns:
            IntakeValidationResult - passed=True if file does NOT exist
        """
        result = IntakeValidationResult(passed=True)
        intake_path = self.get_intake_path(project_slug)

        result.file_exists = intake_path.exists()

        if result.file_exists:
            result.passed = False
            result.message = (
                f"Validation should have blocked submission, but intake.json exists at {intake_path}"
            )
        else:
            result.message = "Validation correctly blocked submission: no intake.json created"

        return result

    def validate_minimal_intake(
        self,
        project_slug: str,
    ) -> IntakeValidationResult:
        """
        Validate that minimal intake (required fields only) produces valid output.

        EVL-CASE-009: Minimal intake accepted

        Empty optional fields should be represented as empty arrays/strings,
        NOT absent from JSON.

        Args:
            project_slug: Project identifier

        Returns:
            IntakeValidationResult with validation details
        """
        result = self.validate_intake_output(project_slug)

        if not result.passed:
            return result

        # Additional check: verify empty optional fields are present (not absent)
        intake_path = self.get_intake_path(project_slug)
        with open(intake_path, "r", encoding="utf-8") as f:
            intake_data = json.load(f)

        optional_fields = ["scope_out", "constraints", "prior_art"]
        missing_optional = []

        for field_name in optional_fields:
            if field_name not in intake_data:
                missing_optional.append(field_name)

        if missing_optional:
            result.passed = False
            result.message = (
                f"Empty optional fields must be present as empty arrays, "
                f"but these are absent: {missing_optional}"
            )
            result.missing_fields.extend(missing_optional)

        return result

    def read_intake_data(self, project_slug: str) -> Optional[Dict[str, Any]]:
        """
        Read and return intake.json data for a project.

        Args:
            project_slug: Project identifier

        Returns:
            Parsed intake data or None if not found/invalid
        """
        intake_path = self.get_intake_path(project_slug)

        if not intake_path.exists():
            return None

        try:
            with open(intake_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None

    def compare_intake_to_input(
        self,
        project_slug: str,
        input_data: Dict[str, Any],
    ) -> IntakeValidationResult:
        """
        Compare saved intake.json to original input data.

        Args:
            project_slug: Project identifier
            input_data: Original input data from intake form

        Returns:
            IntakeValidationResult with comparison details
        """
        # First validate the file itself
        result = self.validate_intake_output(project_slug, expected_values=input_data)
        return result
