export interface MockReport {
  id: number;
  agent: string;
  subject: string;
  status: "complete" | "in_progress" | "blocked";
  summary: string;
  timestamp: string;
}

export interface MockTask {
  id: number;
  taskId: string;
  agent: string;
  description: string;
  status: "pending" | "in_progress" | "complete" | "blocked";
  priority: number;
  timestamp: string;
}

export interface MockSession {
  id: number;
  sessionId: string;
  agent: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface MockAgent {
  id: number;
  name: string;
  role: string;
  status: "active" | "idle" | "offline";
  tasksCompleted: number;
  lastActive: string;
}

export const mockReports: MockReport[] = [
  { id: 1, agent: "framer", subject: "problem-definition-mission-control", status: "complete", summary: "Produced PRB-mission-control-001", timestamp: "2026-03-30 14:00:00" },
  { id: 2, agent: "eval", subject: "eval-spec-mission-control", status: "complete", summary: "Produced EVL-mission-control-001", timestamp: "2026-03-30 14:30:00" },
  { id: 3, agent: "quill", subject: "prd-mission-control", status: "complete", summary: "Produced PRD-mission-control-001 v2.0", timestamp: "2026-03-30 15:00:00" },
  { id: 4, agent: "sketch", subject: "diagrams-mission-control", status: "complete", summary: "Produced DGM-001.mmd architecture diagram", timestamp: "2026-03-30 15:30:00" },
  { id: 5, agent: "planner", subject: "build-plan-mission-control", status: "complete", summary: "Produced BLD-001 build plan with 4 phases", timestamp: "2026-03-30 16:00:00" },
  { id: 6, agent: "forge", subject: "WRK-005-app-shell", status: "complete", summary: "Built Tauri+SolidJS app shell with routing and sidebar", timestamp: "2026-03-30 16:30:00" },
  { id: 7, agent: "forge", subject: "WRK-007-dashboard", status: "complete", summary: "Built Dashboard with project cards, stats bar, activity feed", timestamp: "2026-03-30 17:00:00" },
  { id: 8, agent: "forge", subject: "WRK-008-artifact-browser", status: "complete", summary: "Built ArtifactBrowser with file tree, markdown rendering, frontmatter", timestamp: "2026-03-30 17:30:00" },
  { id: 9, agent: "framer", subject: "problem-definition-alpha-project", status: "complete", summary: "Produced PRB-alpha-project-001", timestamp: "2026-03-30 18:00:00" },
  { id: 10, agent: "eval", subject: "eval-spec-alpha-project", status: "in_progress", summary: "Drafting eval spec for Alpha Project", timestamp: "2026-03-30 18:30:00" },
];

export const mockTasks: MockTask[] = [
  { id: 1, taskId: "WRK-001", agent: "peter", description: "Recruit initial wolf pack agents", status: "complete", priority: 1, timestamp: "2026-03-28 09:00:00" },
  { id: 2, taskId: "WRK-002", agent: "scout", description: "Research Tauri+SolidJS stack", status: "complete", priority: 1, timestamp: "2026-03-28 10:00:00" },
  { id: 3, taskId: "WRK-003", agent: "sigma", description: "Design wolfpack.db schema", status: "complete", priority: 1, timestamp: "2026-03-28 11:00:00" },
  { id: 4, taskId: "WRK-005", agent: "forge", description: "Build app shell with routing", status: "complete", priority: 1, timestamp: "2026-03-29 10:00:00" },
  { id: 5, taskId: "WRK-007", agent: "forge", description: "Build Dashboard view", status: "complete", priority: 1, timestamp: "2026-03-29 14:00:00" },
  { id: 6, taskId: "WRK-008", agent: "forge", description: "Build Artifact Browser", status: "complete", priority: 1, timestamp: "2026-03-30 10:00:00" },
  { id: 7, taskId: "WRK-010", agent: "forge", description: "Project View with pipeline visualization", status: "in_progress", priority: 1, timestamp: "2026-03-30 14:00:00" },
  { id: 8, taskId: "WRK-012", agent: "forge", description: "DB Explorer view", status: "pending", priority: 2, timestamp: "2026-03-30 14:00:00" },
  { id: 9, taskId: "WRK-013", agent: "forge", description: "Multi-project navigation", status: "pending", priority: 2, timestamp: "2026-03-30 14:00:00" },
];

export const mockSessions: MockSession[] = [
  { id: 1, sessionId: "SES-001", agent: "alpha", action: "delegation", detail: "Delegated WRK-005 to forge", timestamp: "2026-03-29 09:00:00" },
  { id: 2, sessionId: "SES-001", agent: "forge", action: "task_start", detail: "Started WRK-005 app shell", timestamp: "2026-03-29 09:05:00" },
  { id: 3, sessionId: "SES-001", agent: "forge", action: "task_complete", detail: "Completed WRK-005 app shell", timestamp: "2026-03-29 12:00:00" },
  { id: 4, sessionId: "SES-002", agent: "alpha", action: "delegation", detail: "Delegated WRK-007 to forge", timestamp: "2026-03-29 13:00:00" },
  { id: 5, sessionId: "SES-002", agent: "forge", action: "task_start", detail: "Started WRK-007 dashboard", timestamp: "2026-03-29 13:05:00" },
  { id: 6, sessionId: "SES-002", agent: "forge", action: "task_complete", detail: "Completed WRK-007 dashboard", timestamp: "2026-03-29 16:00:00" },
  { id: 7, sessionId: "SES-003", agent: "alpha", action: "delegation", detail: "Delegated WRK-008 to forge", timestamp: "2026-03-30 09:00:00" },
  { id: 8, sessionId: "SES-003", agent: "forge", action: "task_start", detail: "Started WRK-008 artifact browser", timestamp: "2026-03-30 09:05:00" },
  { id: 9, sessionId: "SES-003", agent: "forge", action: "task_complete", detail: "Completed WRK-008 artifact browser", timestamp: "2026-03-30 12:00:00" },
  { id: 10, sessionId: "SES-004", agent: "alpha", action: "delegation", detail: "Delegated WRK-010/012/013 to forge", timestamp: "2026-03-30 14:00:00" },
];

export const mockAgents: MockAgent[] = [
  { id: 1, name: "alpha", role: "Pack Leader / Orchestrator", status: "active", tasksCompleted: 12, lastActive: "2026-03-30 18:30:00" },
  { id: 2, name: "forge", role: "TypeScript/Node.js Developer", status: "active", tasksCompleted: 8, lastActive: "2026-03-30 18:00:00" },
  { id: 3, name: "framer", role: "Problem Definition Specialist", status: "idle", tasksCompleted: 4, lastActive: "2026-03-30 18:00:00" },
  { id: 4, name: "eval", role: "Eval Spec Creator", status: "active", tasksCompleted: 3, lastActive: "2026-03-30 18:30:00" },
  { id: 5, name: "quill", role: "PRD Writer", status: "idle", tasksCompleted: 2, lastActive: "2026-03-30 15:00:00" },
  { id: 6, name: "sketch", role: "Diagram Generator", status: "idle", tasksCompleted: 2, lastActive: "2026-03-30 15:30:00" },
  { id: 7, name: "planner", role: "Build Plan Architect", status: "idle", tasksCompleted: 1, lastActive: "2026-03-30 16:00:00" },
  { id: 8, name: "sigma", role: "Database Architect", status: "idle", tasksCompleted: 3, lastActive: "2026-03-29 12:00:00" },
  { id: 9, name: "scout", role: "Research Agent", status: "offline", tasksCompleted: 5, lastActive: "2026-03-29 10:00:00" },
  { id: 10, name: "peter", role: "Agent Recruiter", status: "offline", tasksCompleted: 6, lastActive: "2026-03-28 12:00:00" },
];
