/** Types for database query results and filters */

export interface QueryResult<T = unknown> {
  rows: T[];
  totalCount: number;
}

export interface ReportRow {
  id: number;
  agent: string;
  subject: string;
  status: string;
  summary: string;
  timestamp: string;
}

export interface TaskRow {
  id: number;
  taskId: string;
  agent: string;
  description: string;
  status: string;
  priority: number;
  timestamp: string;
}

export interface SessionRow {
  id: number;
  sessionId: string;
  agent: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface AgentRow {
  id: number;
  name: string;
  role: string;
  status: string;
  tasksCompleted: number;
  reportsCount: number;
  reportsTo: string;
  description: string;
  lastActive: string;
}

export interface ReportFilters {
  search?: string;
  agent?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface TaskFilters {
  search?: string;
  agent?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface SessionFilters {
  search?: string;
  agent?: string;
  limit?: number;
  offset?: number;
}

export interface AgentFilters {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface SessionEvent {
  id: number;  // NOT string - matches Rust
  timestamp: string;
  eventType: string;
  agent: string | null;  // nullable - matches Rust
  content: string;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface SummaryStats {
  tasksByStatus: StatusCount[];
  totalReports: number;
  totalAgents: number;
}
