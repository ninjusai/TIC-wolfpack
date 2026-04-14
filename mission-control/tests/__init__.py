# Wolf Pack Mission Control V1 - Eval Test Harness
"""
Python pytest-based evaluation harness for Mission Control V1.

This harness validates all 27 eval cases from EVL-mission-control-001.

Usage:
    # Run all tests
    pytest tests/ -v

    # Run specific category
    pytest tests/ -v -m session
    pytest tests/ -v -m pipeline
    pytest tests/ -v -m intake

    # Run with coverage
    pytest tests/ --cov=tests/scorers --cov-report=html

Available markers:
    session     - Session continuity tests (EVL-CASE-001, 002)
    project     - Project listing tests (EVL-CASE-003, 004)
    pipeline    - Pipeline display tests (EVL-CASE-005, 006, 007)
    intake      - Intake form tests (EVL-CASE-008, 009, 010)
    artifact    - Artifact browser tests (EVL-CASE-011, 012, 013)
    db          - Database explorer tests (EVL-CASE-014, 015, 016)
    navigation  - Navigation tests (EVL-CASE-017, 018)
    accuracy    - Data accuracy tests (EVL-CASE-019, 020)
    dbcompat    - DB compatibility tests (EVL-CASE-021, 022)
    platform    - Windows platform tests (EVL-CASE-023, 024)
    watcher     - File watcher tests (EVL-CASE-025, 026)
    performance - Performance/scale tests (EVL-CASE-027)
    slow        - Tests that may take longer to run
"""

__version__ = "1.0.0"
__eval_spec__ = "EVL-mission-control-001"
