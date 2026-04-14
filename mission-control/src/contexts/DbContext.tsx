import {
  createContext,
  useContext,
  type ParentComponent,
} from "solid-js";
import { tauriInvoke, TauriUnavailableError } from "../lib/tauri";
import type {
  Project,
  ProjectDetail,
  QueryResult,
  ReportRow,
  TaskRow,
  SessionRow,
  AgentRow,
  ReportFilters,
  TaskFilters,
  SessionFilters,
  AgentFilters,
  SessionEvent,
  SummaryStats,
  ArtifactEntry,
  ArtifactInfo,
  IntakeData,
  SlugValidation,
} from "../types";

/* ───────────── Raw DB Response Types ───────────── */

/** Raw response from Rust query commands */
interface RawQueryResult {
  columns: string[];
  rows: unknown[][];
  totalCount: number;
}

/** Transform raw agent rows from DB into AgentRow objects */
function transformAgentRows(raw: RawQueryResult): QueryResult<AgentRow> {
  // Columns: id, name, role, status, file, reportsTo, description, createdAt
  const rows: AgentRow[] = raw.rows.map((r) => ({
    id: r[0] as number,
    name: (r[1] as string) || "",
    role: (r[2] as string) || "",
    status: (r[3] as string) || "offline",
    tasksCompleted: 0, // Not in DB yet
    reportsCount: 0,   // Not in DB yet
    reportsTo: (r[5] as string) || "",
    description: (r[6] as string) || "",
    lastActive: (r[7] as string) || "",
  }));
  return { rows, totalCount: raw.totalCount };
}

/** Transform raw report rows from DB into ReportRow objects */
function transformReportRows(raw: RawQueryResult): QueryResult<ReportRow> {
  // Columns: id, agent, subject, status, summary, decisions, deliverables, issues, next_steps, created_at
  const rows: ReportRow[] = raw.rows.map((r) => ({
    id: r[0] as number,
    agent: (r[1] as string) || "",
    subject: (r[2] as string) || "",
    status: (r[3] as string) || "",
    summary: (r[4] as string) || "",
    timestamp: (r[9] as string) || "",
  }));
  return { rows, totalCount: raw.totalCount };
}

/** Transform raw task rows from DB into TaskRow objects */
function transformTaskRows(raw: RawQueryResult): QueryResult<TaskRow> {
  // Columns: id, taskId, title, assignedTo, objective, status, createdAt, updatedAt
  const rows: TaskRow[] = raw.rows.map((r) => ({
    id: r[0] as number,
    taskId: (r[1] as string) || "",
    agent: (r[3] as string) || "",
    description: (r[4] as string) || "",
    status: (r[5] as string) || "",
    priority: 0,
    timestamp: (r[6] as string) || "",
  }));
  return { rows, totalCount: raw.totalCount };
}

/** Transform raw session rows from DB into SessionRow objects */
function transformSessionRows(raw: RawQueryResult): QueryResult<SessionRow> {
  // Columns: id, event, agent, content, timestamp
  const rows: SessionRow[] = raw.rows.map((r) => ({
    id: r[0] as number,
    sessionId: String(r[0]),
    agent: (r[2] as string) || "",
    action: (r[1] as string) || "",
    detail: (r[3] as string) || "",
    timestamp: (r[4] as string) || "",
  }));
  return { rows, totalCount: raw.totalCount };
}

/* ───────────── Mock Fallbacks ───────────── */

import { mockProjects, mockProjectDetails } from "../mocks/mockProjects";
import { mockReports, mockTasks, mockSessions, mockAgents } from "../mocks/mockDbData";
import { mockActivity } from "../mocks/mockActivity";
import { mockArtifacts, mockArtifactContents } from "../mocks/mockArtifacts";

/** Adapt the lightweight mock agents to the richer AgentRow shape the UI expects */
function toAgentRows(): AgentRow[] {
  const DESCRIPTIONS: Record<string, string> = {
    alpha: "Pack orchestrator. Delegates all work, tracks progress, enforces protocol.",
    forge: "TypeScript/Node.js specialist. Builds Tauri frontend, backend commands, and tooling.",
    framer: "Defines problems precisely. Produces structured problem-definition artifacts.",
    eval: "Creates eval specs with assertions for each pipeline stage.",
    quill: "Writes detailed PRDs from problem definitions and eval specs.",
    sketch: "Generates Mermaid and Graphviz diagrams from PRDs.",
    planner: "Architects phased build plans from approved PRDs.",
    sigma: "Designs database schemas, migrations, and data models.",
    scout: "Researches technologies, libraries, and best practices.",
    peter: "Recruits and onboards new specialist agents for the pack.",
  };
  const REPORTS_TO: Record<string, string> = {
    forge: "alpha", framer: "alpha", eval: "alpha", quill: "alpha",
    sketch: "alpha", planner: "alpha", sigma: "alpha", scout: "alpha", peter: "alpha",
  };
  return mockAgents.map((a) => ({
    ...a,
    reportsCount: mockReports.filter((r) => r.agent === a.name).length,
    reportsTo: REPORTS_TO[a.name] ?? "",
    description: DESCRIPTIONS[a.name] ?? "",
  }));
}

function mockListProjects(): Project[] {
  return mockProjects as unknown as Project[];
}

function mockGetProject(slug: string): ProjectDetail | null {
  return (mockProjectDetails[slug] as unknown as ProjectDetail) ?? null;
}

function mockQueryReports(filters: ReportFilters): QueryResult<ReportRow> {
  let data: typeof mockReports = [...mockReports];
  if (filters.search) {
    const s = filters.search.toLowerCase();
    data = data.filter((r) => r.subject.toLowerCase().includes(s) || r.summary.toLowerCase().includes(s));
  }
  if (filters.agent) data = data.filter((r) => r.agent === filters.agent);
  if (filters.status) data = data.filter((r) => r.status === filters.status);
  return { rows: data as unknown as ReportRow[], totalCount: data.length };
}

function mockQueryTasks(filters: TaskFilters): QueryResult<TaskRow> {
  let data: typeof mockTasks = [...mockTasks];
  if (filters.search) {
    const s = filters.search.toLowerCase();
    data = data.filter((t) => t.taskId.toLowerCase().includes(s) || t.description.toLowerCase().includes(s));
  }
  if (filters.agent) data = data.filter((t) => t.agent === filters.agent);
  if (filters.status) data = data.filter((t) => t.status === filters.status);
  return { rows: data as unknown as TaskRow[], totalCount: data.length };
}

function mockQuerySessions(filters: SessionFilters): QueryResult<SessionRow> {
  let data: typeof mockSessions = [...mockSessions];
  if (filters.search) {
    const s = filters.search.toLowerCase();
    data = data.filter((r) => r.detail.toLowerCase().includes(s) || r.action.toLowerCase().includes(s));
  }
  if (filters.agent) data = data.filter((r) => r.agent === filters.agent);
  return { rows: data as unknown as SessionRow[], totalCount: data.length };
}

function mockQueryAgents(_filters: AgentFilters): QueryResult<AgentRow> {
  const rows = toAgentRows();
  return { rows, totalCount: rows.length };
}

function mockGetRecentActivity(limit: number): SessionEvent[] {
  return mockActivity.slice(0, limit) as unknown as SessionEvent[];
}

function mockGetSummaryStats(): SummaryStats {
  // Group tasks by status to match Rust SummaryStats
  const statusCounts: Record<string, number> = {};
  for (const task of mockTasks) {
    statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
  }
  const tasksByStatus = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));

  return {
    tasksByStatus,
    totalReports: mockReports.length,
    totalAgents: mockAgents.length,
  };
}

function mockListArtifacts(dir: string): ArtifactEntry[] {
  // dir can be absolute (e.g., "C:\path\artifacts\mission-control") or relative
  // Extract slug from the last path segment (handle both / and \)
  const slug = dir.split(/[\\/]/).pop() ?? "";
  const entries = mockArtifacts[slug] ?? [];
  // Transform to match new ArtifactEntry interface
  return entries.map((a) => ({
    path: a.path,
    name: a.name,
    size: a.size,
    lastModified: new Date().toISOString(),
    isDir: false,
  }));
}

function mockReadArtifact(path: string): ArtifactInfo {
  const content = mockArtifactContents[path] ?? null;
  const entry = Object.values(mockArtifacts)
    .flat()
    .find((a) => a.path === path);
  return {
    path,
    exists: content !== null,
    content,
    frontmatter: null,  // Would be parsed from content
    sizeBytes: entry?.size ?? (content?.length ?? 0),
    modified: new Date().toISOString(),
  };
}

/* ───────────── Context Interface ───────────── */

interface DbContextValue {
  listProjects: (artifactsDir: string) => Promise<Project[]>;
  getProject: (artifactsDir: string, slug: string) => Promise<ProjectDetail | null>;
  queryReports: (filters: ReportFilters) => Promise<QueryResult<ReportRow>>;
  queryTasks: (filters: TaskFilters) => Promise<QueryResult<TaskRow>>;
  querySessions: (filters: SessionFilters) => Promise<QueryResult<SessionRow>>;
  queryAgents: (filters: AgentFilters) => Promise<QueryResult<AgentRow>>;
  readArtifact: (path: string) => Promise<ArtifactInfo>;
  listArtifacts: (dir: string) => Promise<ArtifactEntry[]>;
  getRecentActivity: (limit: number) => Promise<SessionEvent[]>;
  getSummaryStats: () => Promise<SummaryStats>;
  scaffoldProject: (artifactsDir: string, intake: IntakeData) => Promise<string>;
  validateSlug: (artifactsDir: string, slug: string) => Promise<SlugValidation>;
}

const DbContext = createContext<DbContextValue>();

/* ───────────── Provider ───────────── */

export const DbProvider: ParentComponent = (props) => {
  /**
   * Helper: try Tauri IPC first, fall back to mock on TauriUnavailableError.
   */
  async function tryInvoke<T>(cmd: string, args: Record<string, unknown>, fallback: () => T): Promise<T> {
    try {
      return await tauriInvoke<T>(cmd, args);
    } catch (err) {
      if (err instanceof TauriUnavailableError) {
        console.debug(`[DbContext] Tauri unavailable — using mock for ${cmd}`);
        return fallback();
      }
      // Real backend error — still fall back but log
      console.warn(`[DbContext] IPC error for ${cmd}:`, err);
      return fallback();
    }
  }

  const listProjects = async (artifactsDir: string): Promise<Project[]> =>
    tryInvoke("list_projects", { artifactsDir }, () => mockListProjects());

  const getProject = async (artifactsDir: string, slug: string): Promise<ProjectDetail | null> =>
    tryInvoke("get_project", { artifactsDir, slug }, () => mockGetProject(slug));

  const queryReports = async (filters: ReportFilters): Promise<QueryResult<ReportRow>> => {
    try {
      const raw = await tauriInvoke<RawQueryResult>("query_reports", {
        search: filters.search,
        agent: filters.agent,
        status: filters.status,
        limit: filters.limit,
        offset: filters.offset,
      });
      return transformReportRows(raw);
    } catch (err) {
      if (err instanceof TauriUnavailableError) {
        console.debug("[DbContext] Tauri unavailable — using mock for query_reports");
      } else {
        console.warn("[DbContext] IPC error for query_reports:", err);
      }
      return mockQueryReports(filters);
    }
  };

  const queryTasks = async (filters: TaskFilters): Promise<QueryResult<TaskRow>> => {
    try {
      const raw = await tauriInvoke<RawQueryResult>("query_tasks", {
        search: filters.search,
        assignedTo: filters.agent,
        status: filters.status,
        limit: filters.limit,
        offset: filters.offset,
      });
      return transformTaskRows(raw);
    } catch (err) {
      if (err instanceof TauriUnavailableError) {
        console.debug("[DbContext] Tauri unavailable — using mock for query_tasks");
      } else {
        console.warn("[DbContext] IPC error for query_tasks:", err);
      }
      return mockQueryTasks(filters);
    }
  };

  const querySessions = async (filters: SessionFilters): Promise<QueryResult<SessionRow>> => {
    try {
      const raw = await tauriInvoke<RawQueryResult>("query_sessions", {
        search: filters.search,
        agent: filters.agent,
        limit: filters.limit,
        offset: filters.offset,
      });
      return transformSessionRows(raw);
    } catch (err) {
      if (err instanceof TauriUnavailableError) {
        console.debug("[DbContext] Tauri unavailable — using mock for query_sessions");
      } else {
        console.warn("[DbContext] IPC error for query_sessions:", err);
      }
      return mockQuerySessions(filters);
    }
  };

  const queryAgents = async (filters: AgentFilters): Promise<QueryResult<AgentRow>> => {
    try {
      const raw = await tauriInvoke<RawQueryResult>("query_agents", {
        search: filters.search,
        status: filters.status,
      });
      return transformAgentRows(raw);
    } catch (err) {
      if (err instanceof TauriUnavailableError) {
        console.debug("[DbContext] Tauri unavailable — using mock for query_agents");
      } else {
        console.warn("[DbContext] IPC error for query_agents:", err);
      }
      return mockQueryAgents(filters);
    }
  };

  const readArtifact = async (path: string): Promise<ArtifactInfo> =>
    tryInvoke("read_artifact", { path }, () => mockReadArtifact(path));

  const listArtifacts = async (dir: string): Promise<ArtifactEntry[]> =>
    tryInvoke("list_artifacts", { dir }, () => mockListArtifacts(dir));

  const getRecentActivity = async (limit: number): Promise<SessionEvent[]> =>
    tryInvoke("get_recent_activity", { limit }, () => mockGetRecentActivity(limit));

  const getSummaryStats = async (): Promise<SummaryStats> =>
    tryInvoke("get_summary_stats", {}, () => mockGetSummaryStats());

  const scaffoldProject = async (artifactsDir: string, intake: IntakeData): Promise<string> =>
    tryInvoke("scaffold_project", { artifactsDir, intake }, () => intake.slug);

  const validateSlug = async (artifactsDir: string, slug: string): Promise<SlugValidation> =>
    tryInvoke("validate_slug_with_suggestion", { artifactsDir, slug }, () => ({
      available: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length > 0,
      suggestion: null,
    }));

  return (
    <DbContext.Provider
      value={{
        listProjects,
        getProject,
        queryReports,
        queryTasks,
        querySessions,
        queryAgents,
        readArtifact,
        listArtifacts,
        getRecentActivity,
        getSummaryStats,
        scaffoldProject,
        validateSlug,
      }}
    >
      {props.children}
    </DbContext.Provider>
  );
};

export function useDb(): DbContextValue {
  const ctx = useContext(DbContext);
  if (!ctx) {
    throw new Error("useDb must be used within a DbProvider");
  }
  return ctx;
}
