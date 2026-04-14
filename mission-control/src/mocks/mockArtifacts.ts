export interface MockArtifact {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface MockArtifactContent {
  path: string;
  content: string;
}

export const mockArtifacts: Record<string, MockArtifact[]> = {
  "mission-control": [
    { path: "artifacts/mission-control/problem.md", name: "problem.md", size: 5120, type: "md" },
    { path: "artifacts/mission-control/eval-spec.md", name: "eval-spec.md", size: 12800, type: "md" },
    { path: "artifacts/mission-control/prd.md", name: "prd.md", size: 18000, type: "md" },
    { path: "artifacts/mission-control/build-plan.md", name: "build-plan.md", size: 15000, type: "md" },
    { path: "artifacts/mission-control/diagrams/DGM-001.mmd", name: "DGM-001.mmd", size: 2048, type: "mmd" },
    { path: "artifacts/mission-control/config.yaml", name: "config.yaml", size: 512, type: "yaml" },
  ],
  "alpha-project": [
    { path: "artifacts/alpha-project/problem.md", name: "problem.md", size: 4096, type: "md" },
    { path: "artifacts/alpha-project/eval-spec.md", name: "eval-spec.md", size: 9600, type: "md" },
  ],
  "beta-project": [
    { path: "artifacts/beta-project/problem.md", name: "problem.md", size: 3200, type: "md" },
  ],
};

export const mockArtifactContents: Record<string, string> = {
  "artifacts/mission-control/problem.md": `---
id: PRB-001
title: Wolf Pack Mission Control
version: "1.0"
status: approved
author: Alpha
last-updated: "2026-03-28"
---

# Problem Definition: Wolf Pack Mission Control

## Overview

The Wolf Pack development protocol requires a centralized UI for managing projects, monitoring pipeline stages, browsing artifacts, and tracking agent activity. Without a dedicated control surface, all orchestration relies on CLI commands and manual file inspection.

## Problem Statement

Teams using the Wolf Pack protocol lack visibility into:

- **Pipeline progress** across multiple concurrent projects
- **Artifact state** and content at each gate
- **Agent activity** and delegation history
- **Gate review status** and approval workflows

## Impact

Without a visual management layer, project leads must manually query the database, inspect file trees, and parse log files to understand system state. This creates friction, slows decision-making, and increases the chance of missed gate reviews.

## Success Criteria

1. Project leads can see all active projects and their pipeline stages at a glance
2. Artifacts can be browsed and read directly in the UI with proper Markdown rendering
3. Agent activity is visible in a real-time feed
4. Gate reviews can be initiated and tracked from the dashboard
`,
  "artifacts/mission-control/eval-spec.md": `---
id: EVL-001
title: Mission Control Eval Spec
version: "1.0"
status: approved
author: Eval
last-updated: "2026-03-29"
---

# Eval Specification: Mission Control

## Assertions

1. Dashboard loads within 2 seconds and displays project cards
2. Project cards show correct pipeline stage and status
3. Artifact browser renders Markdown with proper formatting
4. File tree navigation updates content panel correctly
5. Activity feed displays entries in reverse chronological order
6. Stats bar reflects accurate counts from project data
`,
  "artifacts/mission-control/prd.md": `---
id: PRD-001
title: Mission Control PRD
version: "2.0"
status: approved
author: Alpha
last-updated: "2026-03-29"
---

# Product Requirements: Wolf Pack Mission Control

## Features

### F1: Dashboard View
- Project cards grid with responsive layout
- Summary statistics bar
- Recent activity feed

### F2: Artifact Browser
- File tree navigation
- Markdown rendering with frontmatter display
- Support for .md, .mmd, .gv, .json, .yaml files

### F3: Pipeline View
- Stage-by-stage pipeline visualization
- Gate review controls

### F4: DB Explorer
- SQLite query interface
- Table browser
`,
  "artifacts/mission-control/build-plan.md": `---
id: BLD-001
title: Mission Control Build Plan
version: "1.0"
status: in-progress
author: Alpha
last-updated: "2026-03-30"
---

# Build Plan: Wolf Pack Mission Control

## Phase 1: Foundation
- Tauri app scaffold with SolidJS frontend
- Routing, shell layout, sidebar navigation

## Phase 2: Core Views
- Dashboard with project cards and stats
- Artifact browser with Markdown rendering
- Project detail view

## Phase 3: Data Integration
- Wire Tauri IPC commands to frontend
- SQLite query interface
- Real-time activity stream

## Phase 4: Polish
- Error handling and loading states
- Keyboard shortcuts
- Theme customization
`,
  "artifacts/mission-control/diagrams/DGM-001.mmd": `graph TD
    A[User] --> B[Mission Control UI]
    B --> C[Tauri Runtime]
    C --> D[SQLite Database]
    C --> E[File System]
    B --> F[Dashboard View]
    B --> G[Artifact Browser]
    B --> H[Pipeline View]
    B --> I[DB Explorer]
    F --> J[Project Cards]
    F --> K[Stats Bar]
    F --> L[Activity Feed]
    G --> M[File Tree]
    G --> N[Markdown Renderer]
`,
  "artifacts/mission-control/config.yaml": `project:
  name: mission-control
  title: Wolf Pack Mission Control
  version: "0.1.0"

pipeline:
  stages:
    - problem
    - eval-spec
    - prd
    - diagrams
    - build-plan

settings:
  auto_gate_review: false
  artifact_dir: artifacts/
  database: wolfpack.db
`,
};
