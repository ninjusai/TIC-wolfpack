/** Barrel export for all Tauri IPC types */

export type {
  Project,
  ProjectDetail,
  PipelineStage,
  PipelineGate,
  ProjectStatus,
  StageStatus,
  GateStatus,
} from "./project";

export type {
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
  StatusCount,
  SummaryStats,
} from "./query";

export type { ArtifactEntry, ArtifactInfo } from "./artifact";

export type { AppSettings } from "./settings";
export { DEFAULT_SETTINGS } from "./settings";

export type { IntakeData, SlugValidation } from "./intake";

export type {
  InterviewStage,
  InterviewSession,
  InterviewMessage,
  InterviewResponse,
  StageInfo,
} from "./interview";

export {
  INTERVIEW_STAGES,
  getStageIndex,
  getStageByIndex,
  getNextStage,
  isLastStage,
} from "./interview";
