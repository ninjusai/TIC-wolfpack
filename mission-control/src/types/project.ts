/** Types for project data returned from Tauri backend */

export type ProjectStatus = "pending" | "in-progress" | "gate-review" | "approved";
export type StageStatus = "pending" | "in-progress" | "complete";
export type GateStatus = "pending" | "passed" | "failed";

export interface PipelineGate {
  status: GateStatus;
  attempts: number;
}

export interface PipelineStage {
  name: string;
  status: StageStatus;
  agent: string;
  artifact: string;
  gate: PipelineGate;
}

export interface Project {
  slug: string;
  title: string;
  description: string;
  status: string;
  mode: string;
  created: string;
  manifest: Record<string, unknown>;
  currentStage: string;
  priority: number;
}

export interface ProjectDetail extends Project {
  mode: string;
  stages: PipelineStage[];
  hasDiscrepancy: boolean;
}
