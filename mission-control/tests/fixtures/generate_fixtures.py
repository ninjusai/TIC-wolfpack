#!/usr/bin/env python3
"""
Fixture Generator for Wolf Pack Mission Control V1 Eval Harness

Generates test data for all three datasets defined in EVL-mission-control-001:
- DS-mission-control-001: Project State Fixtures (5 projects)
- DS-mission-control-002: Intake Form Inputs (3 scenarios)
- DS-mission-control-003: Discrepancy Scenarios (3 conflict cases)

Usage:
    python generate_fixtures.py [--output-dir PATH] [--db-path PATH]

Output:
    - artifacts/ subdirectory with project directories and manifest.json files
    - wolfpack.db SQLite database with test data
    - intake_scenarios.json with test intake data
    - discrepancy_scenarios.json with conflict test data
"""

import json
import os
import shutil
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List


# ---------------------------------------------------------------------------
# Constants and Configuration
# ---------------------------------------------------------------------------

DEFAULT_OUTPUT_DIR = Path(__file__).parent / "generated"
DEFAULT_DB_NAME = "wolfpack.db"

# Pipeline stages in order
PIPELINE_STAGES = ["problem", "eval-spec", "prd", "diagrams", "build-plan"]

# DS-mission-control-001: Project State Fixtures
PROJECT_FIXTURES = [
    {
        "fixture_id": "FIX-001",
        "slug": "alpha-project",
        "title": "Alpha Project - Complete Pipeline",
        "current_stage": "build-plan",
        "mode": "standard",
        "priority": 1,
        "status": "active",
        "tags": ["all-stages-complete"],
        "stages": {
            "problem": {"status": "approved", "gate_status": "passed", "attempts": 1},
            "eval-spec": {"status": "approved", "gate_status": "passed", "attempts": 1},
            "prd": {"status": "approved", "gate_status": "passed", "attempts": 1},
            "diagrams": {"status": "approved", "gate_status": "passed", "attempts": 1},
            "build-plan": {"status": "approved", "gate_status": "passed", "attempts": 1},
        },
        "artifacts": ["problem.md", "eval-spec.md", "prd.md", "build-plan.md", "diagrams/architecture.mmd"],
    },
    {
        "fixture_id": "FIX-002",
        "slug": "beta-project",
        "title": "Beta Project - Mid Pipeline",
        "current_stage": "eval-spec",
        "mode": "standard",
        "priority": 2,
        "status": "active",
        "tags": ["mid-pipeline"],
        "stages": {
            "problem": {"status": "approved", "gate_status": "passed", "attempts": 1},
            "eval-spec": {"status": "in-progress", "gate_status": "pending", "attempts": 0},
            "prd": {"status": "pending", "gate_status": "pending", "attempts": 0},
            "diagrams": {"status": "pending", "gate_status": "pending", "attempts": 0},
            "build-plan": {"status": "pending", "gate_status": "pending", "attempts": 0},
        },
        "artifacts": ["problem.md", "eval-spec.md"],
    },
    {
        "fixture_id": "FIX-003",
        "slug": "gamma-project",
        "title": "Gamma Project - Gate Retry",
        "current_stage": "problem",
        "mode": "standard",
        "priority": 3,
        "status": "active",
        "tags": ["gate-retry"],
        "stages": {
            "problem": {"status": "approved", "gate_status": "passed", "attempts": 2},  # Retry scenario
            "eval-spec": {"status": "pending", "gate_status": "pending", "attempts": 0},
            "prd": {"status": "pending", "gate_status": "pending", "attempts": 0},
            "diagrams": {"status": "pending", "gate_status": "pending", "attempts": 0},
            "build-plan": {"status": "pending", "gate_status": "pending", "attempts": 0},
        },
        "artifacts": ["problem.md"],
    },
    {
        "fixture_id": "FIX-004",
        "slug": "delta-project",
        "title": "Delta Project - PRD Stage",
        "current_stage": "prd",
        "mode": "standard",
        "priority": 4,
        "status": "active",
        "tags": ["mid-pipeline"],
        "stages": {
            "problem": {"status": "approved", "gate_status": "passed", "attempts": 1},
            "eval-spec": {"status": "approved", "gate_status": "passed", "attempts": 1},
            "prd": {"status": "in-progress", "gate_status": "pending", "attempts": 0},
            "diagrams": {"status": "pending", "gate_status": "pending", "attempts": 0},
            "build-plan": {"status": "pending", "gate_status": "pending", "attempts": 0},
        },
        "artifacts": ["problem.md", "eval-spec.md", "prd.md"],
    },
    {
        "fixture_id": "FIX-005",
        "slug": "epsilon-project",
        "title": "Epsilon Project - Fresh Start",
        "current_stage": "problem",
        "mode": "standard",
        "priority": 5,
        "status": "active",
        "tags": ["fresh-project"],
        "stages": {
            "problem": {"status": "in-progress", "gate_status": "pending", "attempts": 0},
            "eval-spec": {"status": "pending", "gate_status": "pending", "attempts": 0},
            "prd": {"status": "pending", "gate_status": "pending", "attempts": 0},
            "diagrams": {"status": "pending", "gate_status": "pending", "attempts": 0},
            "build-plan": {"status": "pending", "gate_status": "pending", "attempts": 0},
        },
        "artifacts": ["problem.md"],
    },
]

# DS-mission-control-002: Intake Form Inputs
INTAKE_FIXTURES = [
    {
        "case_id": "INTAKE-001",
        "tags": ["complete-intake"],
        "intake": {
            "problem": "Users cannot efficiently track their daily tasks across multiple devices, leading to missed deadlines and lost productivity.",
            "users": ["busy professionals", "remote workers", "students"],
            "scope_in": ["cross-device sync", "deadline notifications", "daily digest email"],
            "scope_out": ["team collaboration features", "calendar integration", "mobile app v1"],
            "constraints": ["Must work offline", "GDPR compliant", "Load under 2 seconds"],
            "success_criteria": ["Task sync latency < 500ms", "Zero data loss on offline/online transition", "User satisfaction >= 4.5/5"],
            "prior_art": ["Existing todo.txt system", "Legacy PHP task manager"],
        },
    },
    {
        "case_id": "INTAKE-002",
        "tags": ["minimal-intake"],
        "intake": {
            "problem": "Need a simple CLI tool to convert markdown files to HTML.",
            "users": ["developers"],
            "scope_in": ["markdown to HTML conversion"],
            "scope_out": [],
            "constraints": "",
            "success_criteria": ["Output valid HTML5"],
            "prior_art": "",
        },
    },
    {
        "case_id": "INTAKE-003",
        "tags": ["no-constraints"],
        "intake": {
            "problem": "Customer support tickets take too long to resolve, averaging 48 hours response time.",
            "users": ["customer support agents", "end customers", "support managers"],
            "scope_in": ["ticket categorization", "priority assignment", "response templates", "SLA tracking"],
            "scope_out": ["chatbot integration", "phone support"],
            "constraints": "none",
            "success_criteria": ["Average response time < 4 hours", "Customer satisfaction >= 4.0/5", "Agent throughput increased by 30%"],
            "prior_art": "none",
        },
    },
]

# DS-mission-control-003: Discrepancy Scenarios
DISCREPANCY_FIXTURES = [
    {
        "case_id": "DISC-001",
        "tags": ["stage-mismatch"],
        "description": "manifest.json says stage 'eval-spec', last DB task entry says stage 'prd'",
        "manifest_stage": "eval-spec",
        "db_stage": "prd",
        "project_slug": "discrepancy-stage-project",
    },
    {
        "case_id": "DISC-002",
        "tags": ["agent-mismatch"],
        "description": "manifest.json lists agent 'framer', DB report lists agent 'quill' for same artifact",
        "manifest_agent": "framer",
        "db_agent": "quill",
        "project_slug": "discrepancy-agent-project",
    },
    {
        "case_id": "DISC-003",
        "tags": ["missing-audit"],
        "description": "manifest.json gate status 'passed', DB has no corresponding gate-passed session log",
        "manifest_gate_status": "passed",
        "db_has_gate_log": False,
        "project_slug": "discrepancy-audit-project",
    },
]


# ---------------------------------------------------------------------------
# Artifact Content Templates
# ---------------------------------------------------------------------------

def generate_problem_md(project: Dict[str, Any]) -> str:
    """Generate a problem.md artifact file content."""
    return f'''---
id: "PRB-{project["slug"]}-001"
title: "{project["title"]} - Problem Definition"
version: "1.0.0"
status: "{project["stages"]["problem"]["status"]}"
author: "framer"
last-updated: "{datetime.now().strftime("%Y-%m-%d")}"
---

# Problem Definition: {project["title"]}

## Problem Statement

This is a synthetic problem statement for {project["slug"]} used for eval testing.
The project aims to solve key challenges in its domain.

## Users

- Primary users: domain experts
- Secondary users: administrators

## Scope

### In Scope
- Core functionality
- Essential features

### Out of Scope
- Advanced analytics
- Third-party integrations

## Success Criteria

1. Core features complete and functional
2. All tests pass
3. Documentation complete

## Constraints

- Must be completed within timeline
- Must follow established patterns

## Assumptions

- Users have basic technical knowledge
- Infrastructure is available
'''


def generate_eval_spec_md(project: Dict[str, Any]) -> str:
    """Generate an eval-spec.md artifact file content."""
    return f'''---
id: "EVL-{project["slug"]}-001"
title: "{project["title"]} - Eval Spec"
version: "1.0.0"
status: "{project["stages"]["eval-spec"]["status"]}"
author: "eval"
last-updated: "{datetime.now().strftime("%Y-%m-%d")}"
traces-to:
  problem: "PRB-{project["slug"]}-001"
---

# Eval Spec: {project["title"]}

## Overview

This eval spec defines validation criteria for {project["slug"]}.

## Datasets

### DS-001 - Test Data
- Size: 100 test cases
- Source: Synthetic

## Rubrics

### RBR-001 - Functionality
- Dimension: Feature completeness
- Scale: Binary pass/fail

## Eval Cases

### EVL-CASE-001 - Basic Functionality
- Input: Standard test inputs
- Expected: Correct outputs
- Tags: happy-path

## Scorers

### SCR-001 - Output Validator
- Type: algorithmic
- Pass condition: Output matches expected
'''


def generate_prd_md(project: Dict[str, Any]) -> str:
    """Generate a prd.md artifact file content."""
    return f'''---
id: "PRD-{project["slug"]}-001"
title: "{project["title"]} - Product Requirements"
version: "1.0.0"
status: "{project["stages"]["prd"]["status"]}"
author: "quill"
last-updated: "{datetime.now().strftime("%Y-%m-%d")}"
traces-to:
  problem: "PRB-{project["slug"]}-001"
  eval-spec: "EVL-{project["slug"]}-001"
---

# PRD: {project["title"]}

## Problem Summary

See PRB-{project["slug"]}-001 for full problem definition.

## Goals

| ID | Goal | Measure |
|----|------|---------|
| GOAL-01 | Core functionality | 100% feature completion |

## Requirements

### REQ-{project["slug"]}-001 - Core Feature

**Priority:** P0
**Description:** Implement the core functionality.
**Eval Trace:** EVL-CASE-001
**Acceptance Criteria:**
- Feature works as specified
- All tests pass
'''


def generate_build_plan_md(project: Dict[str, Any]) -> str:
    """Generate a build-plan.md artifact file content."""
    return f'''---
id: "BLD-{project["slug"]}-001"
title: "{project["title"]} - Build Plan"
version: "1.0.0"
status: "{project["stages"]["build-plan"]["status"]}"
author: "planner"
last-updated: "{datetime.now().strftime("%Y-%m-%d")}"
traces-to:
  problem: "PRB-{project["slug"]}-001"
  eval-spec: "EVL-{project["slug"]}-001"
  prd: "PRD-{project["slug"]}-001"
---

# Build Plan: {project["title"]}

## Execution Phases

### Phase 1: Foundation
- Setup project structure
- Implement core modules

### Phase 2: Features
- Implement requirements
- Integration testing

## Work Items

### WRK-{project["slug"]}-001 - Core Implementation

**Traces to:** REQ-{project["slug"]}-001
**Agent:** forge
**Complexity:** M
**Dependencies:** None

## Validation Matrix

| WRK | REQ | EVL-CASE |
|-----|-----|----------|
| WRK-001 | REQ-001 | EVL-CASE-001 |
'''


def generate_diagram_mmd(project: Dict[str, Any]) -> str:
    """Generate a Mermaid diagram file content."""
    return f'''---
id: "DGM-{project["slug"]}-001"
title: "{project["title"]} - Architecture"
version: "1.0.0"
author: "sketch"
traces-to:
  requirements: ["REQ-{project["slug"]}-001"]
---

graph TD
    A[User] --> B[Frontend]
    B --> C[Backend]
    C --> D[Database]
    C --> E[External API]
'''


# ---------------------------------------------------------------------------
# Database Setup
# ---------------------------------------------------------------------------

def create_database_schema(db_path: Path) -> sqlite3.Connection:
    """Create the wolfpack.db schema matching init_db.py."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            agent TEXT NOT NULL,
            subject TEXT NOT NULL,
            task_id TEXT,
            status TEXT NOT NULL DEFAULT 'complete',
            summary TEXT,
            decisions TEXT,
            deliverables TEXT,
            issues TEXT,
            next_steps TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT UNIQUE NOT NULL,
            date TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            assigned_to TEXT,
            objective TEXT,
            context TEXT,
            subtasks_json TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS session_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            session_id TEXT NOT NULL,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            event_type TEXT NOT NULL,
            agent TEXT,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            file TEXT,
            reports_to TEXT,
            description TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            deactivated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_reports_agent ON reports(agent);
        CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
        CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
        CREATE INDEX IF NOT EXISTS idx_session_logs_date ON session_logs(date);
        CREATE INDEX IF NOT EXISTS idx_session_logs_event ON session_logs(event_type);
        CREATE INDEX IF NOT EXISTS idx_session_logs_agent ON session_logs(agent);
    """)

    conn.commit()
    return conn


def populate_database(conn: sqlite3.Connection, projects: List[Dict[str, Any]]) -> None:
    """Populate the database with test data for the project fixtures."""
    cursor = conn.cursor()
    base_date = datetime.now() - timedelta(days=30)

    # Insert agents
    agents = [
        ("alpha", "Pack Leader", "active", "agents/alpha.md", None, "Orchestrator of the Wolf Pack"),
        ("framer", "Problem Framer", "active", "agents/framer.md", "alpha", "Frames problem statements"),
        ("eval", "Eval Engineer", "active", "agents/eval.md", "alpha", "Creates eval specs"),
        ("quill", "PRD Writer", "active", "agents/quill.md", "alpha", "Writes PRDs"),
        ("sketch", "Diagram Creator", "active", "agents/sketch.md", "alpha", "Creates diagrams"),
        ("planner", "Build Planner", "active", "agents/planner.md", "alpha", "Creates build plans"),
        ("forge", "Code Builder", "active", "agents/forge.md", "alpha", "Implements code"),
    ]

    for agent in agents:
        cursor.execute(
            """INSERT OR IGNORE INTO agents (name, role, status, file, reports_to, description, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (*agent, base_date.strftime("%Y-%m-%d %H:%M:%S")),
        )

    # Insert reports for each project
    report_count = 0
    for project in projects:
        project_date = base_date + timedelta(days=report_count)

        # Create reports based on completed stages
        for stage_name, stage_data in project["stages"].items():
            if stage_data["status"] in ["approved", "in-progress"]:
                agent_for_stage = {
                    "problem": "framer",
                    "eval-spec": "eval",
                    "prd": "quill",
                    "diagrams": "sketch",
                    "build-plan": "planner",
                }.get(stage_name, "alpha")

                cursor.execute(
                    """INSERT INTO reports (date, agent, subject, task_id, status, summary, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        project_date.strftime("%Y-%m-%d"),
                        agent_for_stage,
                        f"Completed {stage_name} for {project['slug']}",
                        f"TSK-{project['slug']}-{stage_name}",
                        "complete" if stage_data["status"] == "approved" else "in-progress",
                        f"Generated {stage_name} artifact for project {project['slug']}",
                        project_date.strftime("%Y-%m-%d %H:%M:%S"),
                    ),
                )
                report_count += 1

    # Insert tasks
    task_count = 0
    for project in projects:
        for stage_name, stage_data in project["stages"].items():
            task_status = "complete" if stage_data["status"] == "approved" else (
                "in-progress" if stage_data["status"] == "in-progress" else "pending"
            )
            agent_for_stage = {
                "problem": "framer",
                "eval-spec": "eval",
                "prd": "quill",
                "diagrams": "sketch",
                "build-plan": "planner",
            }.get(stage_name, "alpha")

            task_date = base_date + timedelta(days=task_count)
            cursor.execute(
                """INSERT OR IGNORE INTO tasks (task_id, date, title, status, assigned_to, objective, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"TSK-{project['slug']}-{stage_name}",
                    task_date.strftime("%Y-%m-%d"),
                    f"Create {stage_name} for {project['slug']}",
                    task_status,
                    agent_for_stage,
                    f"Produce {stage_name} artifact for project {project['slug']}",
                    task_date.strftime("%Y-%m-%d %H:%M:%S"),
                    task_date.strftime("%Y-%m-%d %H:%M:%S"),
                ),
            )
            task_count += 1

    # Insert session logs
    session_count = 0
    session_id = "eval-test-session-001"
    for project in projects:
        for stage_name, stage_data in project["stages"].items():
            if stage_data["gate_status"] == "passed":
                log_date = base_date + timedelta(days=session_count)
                cursor.execute(
                    """INSERT INTO session_logs (date, session_id, timestamp, event_type, agent, content, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        log_date.strftime("%Y-%m-%d"),
                        session_id,
                        log_date.strftime("%Y-%m-%d %H:%M:%S"),
                        "gate-passed",
                        "alpha",
                        f"Gate passed for {stage_name} in {project['slug']} (attempts: {stage_data['attempts']})",
                        log_date.strftime("%Y-%m-%d %H:%M:%S"),
                    ),
                )
                session_count += 1

    conn.commit()


# ---------------------------------------------------------------------------
# Manifest Generation
# ---------------------------------------------------------------------------

def generate_manifest(project: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a manifest.json structure for a project."""
    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    created = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")

    stages_manifest = {}
    for stage_name, stage_data in project["stages"].items():
        agent_for_stage = {
            "problem": "framer",
            "eval-spec": "eval",
            "prd": "quill",
            "diagrams": "sketch",
            "build-plan": "planner",
        }.get(stage_name, None)

        artifact_id = None
        artifact_file = None
        if stage_data["status"] in ["approved", "in-progress"]:
            prefix_map = {
                "problem": "PRB",
                "eval-spec": "EVL",
                "prd": "PRD",
                "diagrams": "DGM",
                "build-plan": "BLD",
            }
            prefix = prefix_map.get(stage_name, "ART")
            artifact_id = f"{prefix}-{project['slug']}-001"
            if stage_name == "diagrams":
                artifact_file = f"artifacts/{project['slug']}/diagrams/"
            else:
                artifact_file = f"artifacts/{project['slug']}/{stage_name}.md"

        gate_id_map = {"problem": "G1", "eval-spec": "G2", "prd": "G3", "diagrams": "G4", "build-plan": "G5"}

        stages_manifest[stage_name] = {
            "status": stage_data["status"],
            "artifact_id": artifact_id,
            "file": artifact_file,
            "assigned_to": agent_for_stage,
            "started": created if stage_data["status"] != "pending" else None,
            "completed": now if stage_data["status"] == "approved" else None,
            "gate": {
                "id": gate_id_map.get(stage_name, "G0"),
                "status": stage_data["gate_status"],
                "passed_at": now if stage_data["gate_status"] == "passed" else None,
                "attempts": stage_data["attempts"],
            },
        }

    return {
        "project": {
            "slug": project["slug"],
            "title": project["title"],
            "created": created,
            "mode": project["mode"],
            "priority": project["priority"],
            "status": project["status"],
        },
        "pipeline": {
            "current_stage": project["current_stage"],
            "stages": stages_manifest,
        },
        # Include top-level fields for simpler parsing (matches intake.rs expectations)
        "slug": project["slug"],
        "title": project["title"],
        "mode": project["mode"],
        "priority": project["priority"],
        "status": project["status"],
        "current_stage": project["current_stage"],
        "created": created,
    }


# ---------------------------------------------------------------------------
# Fixture Generation Functions
# ---------------------------------------------------------------------------

def generate_project_fixtures(output_dir: Path) -> List[Dict[str, Any]]:
    """Generate DS-mission-control-001: Project State Fixtures."""
    artifacts_dir = output_dir / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    generated_projects = []

    for project in PROJECT_FIXTURES:
        project_dir = artifacts_dir / project["slug"]
        project_dir.mkdir(exist_ok=True)
        diagrams_dir = project_dir / "diagrams"
        diagrams_dir.mkdir(exist_ok=True)

        # Generate manifest.json
        manifest = generate_manifest(project)
        with open(project_dir / "manifest.json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        # Generate artifact files based on project stage
        artifact_generators = {
            "problem.md": generate_problem_md,
            "eval-spec.md": generate_eval_spec_md,
            "prd.md": generate_prd_md,
            "build-plan.md": generate_build_plan_md,
        }

        for artifact in project["artifacts"]:
            if artifact.startswith("diagrams/"):
                # Generate diagram file
                diagram_content = generate_diagram_mmd(project)
                diagram_path = project_dir / artifact
                with open(diagram_path, "w", encoding="utf-8") as f:
                    f.write(diagram_content)
            elif artifact in artifact_generators:
                content = artifact_generators[artifact](project)
                with open(project_dir / artifact, "w", encoding="utf-8") as f:
                    f.write(content)

        generated_projects.append({
            "fixture_id": project["fixture_id"],
            "slug": project["slug"],
            "path": str(project_dir),
            "manifest_path": str(project_dir / "manifest.json"),
            "artifacts": project["artifacts"],
            "tags": project["tags"],
        })

    return generated_projects


def generate_intake_fixtures(output_dir: Path) -> List[Dict[str, Any]]:
    """Generate DS-mission-control-002: Intake Form Inputs."""
    intake_file = output_dir / "intake_scenarios.json"

    # Transform intake data to match expected intake.json schema
    scenarios = []
    for intake in INTAKE_FIXTURES:
        scenario = {
            "case_id": intake["case_id"],
            "tags": intake["tags"],
            "input": {
                "problem": intake["intake"]["problem"],
                "users": intake["intake"]["users"] if isinstance(intake["intake"]["users"], list) else [intake["intake"]["users"]],
                "scope_in": intake["intake"]["scope_in"] if isinstance(intake["intake"]["scope_in"], list) else [],
                "scope_out": intake["intake"]["scope_out"] if isinstance(intake["intake"]["scope_out"], list) else [],
                "constraints": intake["intake"]["constraints"] if isinstance(intake["intake"]["constraints"], list) else ([] if intake["intake"]["constraints"] in ["", "none"] else [intake["intake"]["constraints"]]),
                "success_criteria": intake["intake"]["success_criteria"] if isinstance(intake["intake"]["success_criteria"], list) else [intake["intake"]["success_criteria"]],
                "prior_art": intake["intake"]["prior_art"] if isinstance(intake["intake"]["prior_art"], list) else ([] if intake["intake"]["prior_art"] in ["", "none"] else [intake["intake"]["prior_art"]]),
            },
            "expected_output_valid": True,
        }
        scenarios.append(scenario)

    with open(intake_file, "w", encoding="utf-8") as f:
        json.dump(scenarios, f, indent=2)

    return scenarios


def generate_discrepancy_fixtures(output_dir: Path, conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Generate DS-mission-control-003: Discrepancy Scenarios."""
    artifacts_dir = output_dir / "artifacts"
    discrepancy_file = output_dir / "discrepancy_scenarios.json"

    generated = []

    for disc in DISCREPANCY_FIXTURES:
        project_dir = artifacts_dir / disc["project_slug"]
        project_dir.mkdir(parents=True, exist_ok=True)
        (project_dir / "diagrams").mkdir(exist_ok=True)

        # Create a manifest that will conflict with DB
        manifest = {
            "slug": disc["project_slug"],
            "title": f"Discrepancy Test - {disc['case_id']}",
            "mode": "standard",
            "priority": 99,
            "status": "active",
            "current_stage": disc.get("manifest_stage", "problem"),
            "created": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "project": {
                "slug": disc["project_slug"],
                "title": f"Discrepancy Test - {disc['case_id']}",
            },
            "pipeline": {
                "current_stage": disc.get("manifest_stage", "problem"),
                "stages": {
                    "problem": {
                        "status": "approved",
                        "assigned_to": disc.get("manifest_agent", "framer"),
                        "gate": {
                            "status": disc.get("manifest_gate_status", "passed"),
                            "attempts": 1,
                        },
                    },
                },
            },
        }

        with open(project_dir / "manifest.json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        # Create conflicting DB entries
        cursor = conn.cursor()

        if disc["case_id"] == "DISC-001":
            # Stage mismatch: DB says different stage
            cursor.execute(
                """INSERT INTO tasks (task_id, date, title, status, assigned_to, objective, context, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"TSK-{disc['project_slug']}-conflict",
                    datetime.now().strftime("%Y-%m-%d"),
                    f"Task at stage {disc['db_stage']}",
                    "in-progress",
                    "quill",
                    "Conflicting stage task",
                    f"current_stage:{disc['db_stage']}",
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                ),
            )

        elif disc["case_id"] == "DISC-002":
            # Agent mismatch: DB report shows different agent
            cursor.execute(
                """INSERT INTO reports (date, agent, subject, status, summary, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    datetime.now().strftime("%Y-%m-%d"),
                    disc["db_agent"],  # Different from manifest_agent
                    f"Report for {disc['project_slug']} problem.md",
                    "complete",
                    "Agent mismatch scenario",
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                ),
            )

        elif disc["case_id"] == "DISC-003":
            # Missing audit: manifest says passed but no gate-passed log
            # Don't insert a session log - that's the discrepancy
            pass

        conn.commit()

        generated.append({
            "case_id": disc["case_id"],
            "project_slug": disc["project_slug"],
            "description": disc["description"],
            "tags": disc["tags"],
            "manifest_path": str(project_dir / "manifest.json"),
        })

    with open(discrepancy_file, "w", encoding="utf-8") as f:
        json.dump(generated, f, indent=2)

    return generated


def generate_all_fixtures(output_dir: Path = DEFAULT_OUTPUT_DIR) -> Dict[str, Any]:
    """Generate all test fixtures for the eval harness."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Create database
    db_path = output_dir / DEFAULT_DB_NAME
    conn = create_database_schema(db_path)

    # Generate project fixtures and populate DB
    projects = generate_project_fixtures(output_dir)
    populate_database(conn, PROJECT_FIXTURES)

    # Generate intake fixtures
    intakes = generate_intake_fixtures(output_dir)

    # Generate discrepancy fixtures (needs DB connection)
    discrepancies = generate_discrepancy_fixtures(output_dir, conn)

    conn.close()

    summary = {
        "output_dir": str(output_dir),
        "database_path": str(db_path),
        "datasets": {
            "DS-mission-control-001": {
                "name": "Project State Fixtures",
                "count": len(projects),
                "projects": projects,
            },
            "DS-mission-control-002": {
                "name": "Intake Form Inputs",
                "count": len(intakes),
                "scenarios": intakes,
            },
            "DS-mission-control-003": {
                "name": "Discrepancy Scenarios",
                "count": len(discrepancies),
                "scenarios": discrepancies,
            },
        },
    }

    # Write summary
    with open(output_dir / "fixtures_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    return summary


def cleanup_fixtures(output_dir: Path = DEFAULT_OUTPUT_DIR) -> None:
    """Remove all generated fixtures."""
    if output_dir.exists():
        shutil.rmtree(output_dir)


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate test fixtures for Mission Control V1 eval harness")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Output directory for fixtures")
    parser.add_argument("--clean", action="store_true", help="Remove existing fixtures before generating")

    args = parser.parse_args()

    if args.clean:
        print(f"Cleaning existing fixtures at {args.output_dir}...")
        cleanup_fixtures(args.output_dir)

    print(f"Generating fixtures to {args.output_dir}...")
    summary = generate_all_fixtures(args.output_dir)

    print(f"\nGenerated fixtures:")
    print(f"  - Database: {summary['database_path']}")
    for ds_id, ds_data in summary["datasets"].items():
        print(f"  - {ds_id}: {ds_data['name']} ({ds_data['count']} items)")

    print(f"\nFixtures ready at: {summary['output_dir']}")
