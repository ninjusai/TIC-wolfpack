export interface MockProject {
  slug: string;
  title: string;
  currentStage: string;
  status: "pending" | "in-progress" | "gate-review" | "approved";
  priority: number;
}

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

export interface ProjectDetail {
  slug: string;
  title: string;
  mode: string;
  priority: number;
  status: string;
  currentStage: string;
  stages: PipelineStage[];
  hasDiscrepancy: boolean;
}

export const STAGE_LABELS: Record<string, { index: number; label: string }> = {
  problem: { index: 1, label: "Problem" },
  "eval-spec": { index: 2, label: "Eval Spec" },
  prd: { index: 3, label: "PRD" },
  diagrams: { index: 4, label: "Diagrams" },
  "build-plan": { index: 5, label: "Build Plan" },
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-yellow/20", text: "text-yellow", label: "Pending" },
  "in-progress": { bg: "bg-blue/20", text: "text-blue", label: "In Progress" },
  "gate-review": { bg: "bg-accent/20", text: "text-accent", label: "Gate Review" },
  approved: { bg: "bg-green/20", text: "text-green", label: "Approved" },
};

export const mockProjects: MockProject[] = [
  {
    slug: "mission-control",
    title: "Wolf Pack Mission Control",
    currentStage: "build-plan",
    status: "in-progress",
    priority: 1,
  },
  {
    slug: "alpha-project",
    title: "Alpha Project",
    currentStage: "eval-spec",
    status: "gate-review",
    priority: 2,
  },
  {
    slug: "beta-project",
    title: "Beta Project",
    currentStage: "problem",
    status: "pending",
    priority: 3,
  },
  {
    slug: "gamma-analytics",
    title: "Gamma Analytics Platform",
    currentStage: "prd",
    status: "in-progress",
    priority: 4,
  },
  {
    slug: "delta-api",
    title: "Delta API Gateway",
    currentStage: "diagrams",
    status: "approved",
    priority: 5,
  },
  {
    slug: "epsilon-auth",
    title: "Epsilon Auth Service",
    currentStage: "eval-spec",
    status: "pending",
    priority: 6,
  },
];

export const mockProjectDetails: Record<string, ProjectDetail> = {
  "mission-control": {
    slug: "mission-control",
    title: "Wolf Pack Mission Control",
    mode: "standard",
    priority: 1,
    status: "in-progress",
    currentStage: "build-plan",
    stages: [
      { name: "Problem", status: "complete", agent: "framer", artifact: "problem.md", gate: { status: "passed", attempts: 1 } },
      { name: "Eval Spec", status: "complete", agent: "eval", artifact: "eval-spec.md", gate: { status: "passed", attempts: 1 } },
      { name: "PRD", status: "complete", agent: "quill", artifact: "prd.md", gate: { status: "passed", attempts: 1 } },
      { name: "Diagrams", status: "complete", agent: "sketch", artifact: "diagrams/", gate: { status: "passed", attempts: 1 } },
      { name: "Build Plan", status: "complete", agent: "planner", artifact: "build-plan.md", gate: { status: "passed", attempts: 1 } },
    ],
    hasDiscrepancy: false,
  },
  "alpha-project": {
    slug: "alpha-project",
    title: "Alpha Project",
    mode: "standard",
    priority: 2,
    status: "gate-review",
    currentStage: "eval-spec",
    stages: [
      { name: "Problem", status: "complete", agent: "framer", artifact: "problem.md", gate: { status: "passed", attempts: 1 } },
      { name: "Eval Spec", status: "in-progress", agent: "eval", artifact: "eval-spec.md", gate: { status: "pending", attempts: 0 } },
      { name: "PRD", status: "pending", agent: "quill", artifact: "", gate: { status: "pending", attempts: 0 } },
      { name: "Diagrams", status: "pending", agent: "sketch", artifact: "", gate: { status: "pending", attempts: 0 } },
      { name: "Build Plan", status: "pending", agent: "planner", artifact: "", gate: { status: "pending", attempts: 0 } },
    ],
    hasDiscrepancy: false,
  },
  "beta-project": {
    slug: "beta-project",
    title: "Beta Project",
    mode: "fast-track",
    priority: 3,
    status: "pending",
    currentStage: "problem",
    stages: [
      { name: "Problem", status: "in-progress", agent: "framer", artifact: "problem.md", gate: { status: "pending", attempts: 0 } },
      { name: "Eval Spec", status: "pending", agent: "eval", artifact: "", gate: { status: "pending", attempts: 0 } },
      { name: "PRD", status: "pending", agent: "quill", artifact: "", gate: { status: "pending", attempts: 0 } },
      { name: "Diagrams", status: "pending", agent: "sketch", artifact: "", gate: { status: "pending", attempts: 0 } },
      { name: "Build Plan", status: "pending", agent: "planner", artifact: "", gate: { status: "pending", attempts: 0 } },
    ],
    hasDiscrepancy: true,
  },
  "gamma-analytics": {
    slug: "gamma-analytics",
    title: "Gamma Analytics Platform",
    mode: "standard",
    priority: 4,
    status: "in-progress",
    currentStage: "prd",
    stages: [
      { name: "Problem", status: "complete", agent: "framer", artifact: "problem.md", gate: { status: "passed", attempts: 1 } },
      { name: "Eval Spec", status: "complete", agent: "eval", artifact: "eval-spec.md", gate: { status: "passed", attempts: 2 } },
      { name: "PRD", status: "in-progress", agent: "quill", artifact: "prd.md", gate: { status: "pending", attempts: 0 } },
      { name: "Diagrams", status: "pending", agent: "sketch", artifact: "", gate: { status: "pending", attempts: 0 } },
      { name: "Build Plan", status: "pending", agent: "planner", artifact: "", gate: { status: "pending", attempts: 0 } },
    ],
    hasDiscrepancy: false,
  },
  "delta-api": {
    slug: "delta-api",
    title: "Delta API Gateway",
    mode: "standard",
    priority: 5,
    status: "approved",
    currentStage: "diagrams",
    stages: [
      { name: "Problem", status: "complete", agent: "framer", artifact: "problem.md", gate: { status: "passed", attempts: 1 } },
      { name: "Eval Spec", status: "complete", agent: "eval", artifact: "eval-spec.md", gate: { status: "passed", attempts: 1 } },
      { name: "PRD", status: "complete", agent: "quill", artifact: "prd.md", gate: { status: "passed", attempts: 1 } },
      { name: "Diagrams", status: "in-progress", agent: "sketch", artifact: "diagrams/", gate: { status: "failed", attempts: 2 } },
      { name: "Build Plan", status: "pending", agent: "planner", artifact: "", gate: { status: "pending", attempts: 0 } },
    ],
    hasDiscrepancy: false,
  },
  "epsilon-auth": {
    slug: "epsilon-auth",
    title: "Epsilon Auth Service",
    mode: "fast-track",
    priority: 6,
    status: "pending",
    currentStage: "eval-spec",
    stages: [
      { name: "Problem", status: "complete", agent: "framer", artifact: "problem.md", gate: { status: "passed", attempts: 1 } },
      { name: "Eval Spec", status: "in-progress", agent: "eval", artifact: "", gate: { status: "pending", attempts: 0 } },
      { name: "PRD", status: "pending", agent: "quill", artifact: "", gate: { status: "pending", attempts: 0 } },
      { name: "Diagrams", status: "pending", agent: "sketch", artifact: "", gate: { status: "pending", attempts: 0 } },
      { name: "Build Plan", status: "pending", agent: "planner", artifact: "", gate: { status: "pending", attempts: 0 } },
    ],
    hasDiscrepancy: false,
  },
};
