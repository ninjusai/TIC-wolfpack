export interface MockActivityEntry {
  id: number;  // Matches Rust: id is number, not string
  timestamp: string;
  eventType: string;
  agent: string | null;  // Matches Rust: agent is nullable
  content: string;
}

export const mockActivity: MockActivityEntry[] = [
  {
    id: 1,
    timestamp: "2026-03-30T14:32:00Z",
    eventType: "task_complete",
    agent: "Forge",
    content: "Implemented Dashboard view with project cards grid, stats bar, and activity feed for Mission Control frontend.",
  },
  {
    id: 2,
    timestamp: "2026-03-30T13:15:00Z",
    eventType: "delegation",
    agent: "Alpha",
    content: "Delegated WRK-009 and WRK-011 to Forge: Dashboard View and Artifact Browser implementation.",
  },
  {
    id: 3,
    timestamp: "2026-03-30T11:45:00Z",
    eventType: "research",
    agent: "Scout",
    content: "Completed evaluation of SolidJS markdown rendering options. Recommended marked library for lightweight parsing.",
  },
  {
    id: 4,
    timestamp: "2026-03-29T22:10:00Z",
    eventType: "task_complete",
    agent: "Forge",
    content: "Built app shell with routing, sidebar navigation, header, and context providers (WRK-007).",
  },
  {
    id: 5,
    timestamp: "2026-03-29T18:30:00Z",
    eventType: "schema_update",
    agent: "Sigma",
    content: "Updated wolfpack.db schema to include session_logs table with agent, event_type, and content columns.",
  },
  {
    id: 6,
    timestamp: "2026-03-29T15:00:00Z",
    eventType: "recruitment",
    agent: "Peter",
    content: "Recruited Forge agent for TypeScript/Node.js development. Updated registry.json with capabilities.",
  },
  {
    id: 7,
    timestamp: "2026-03-29T12:20:00Z",
    eventType: "eval_run",
    agent: "Eval",
    content: "Ran eval suite on problem definition artifacts. All 12 assertions passed for mission-control project.",
  },
  {
    id: 8,
    timestamp: "2026-03-28T20:45:00Z",
    eventType: "gate_review",
    agent: "Alpha",
    content: "Approved PRD for Delta API Gateway project. Moving to diagrams stage.",
  },
  {
    id: 9,
    timestamp: "2026-03-28T16:00:00Z",
    eventType: "ci_run",
    agent: "Pipeline",
    content: "CI pipeline passed for commit abc1234. All type checks, lint, and build steps succeeded.",
  },
  {
    id: 10,
    timestamp: "2026-03-28T10:30:00Z",
    eventType: "task_start",
    agent: "Forge",
    content: "Starting implementation of Tauri backend commands for project CRUD operations.",
  },
];
