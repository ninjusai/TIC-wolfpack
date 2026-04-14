import type { Component } from "solid-js";
import { For, createSignal, createMemo, onMount } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { useProject } from "../contexts/ProjectContext";
import { useDb } from "../contexts/DbContext";
import { useSettings } from "../contexts/SettingsContext";
import type { Project, SessionEvent, SummaryStats, StatusCount } from "../types";

/* ───────────── Stage/Status Helpers ───────────── */

const STAGE_LABELS: Record<string, { index: number; label: string }> = {
  problem: { index: 1, label: "Problem" },
  "eval-spec": { index: 2, label: "Eval Spec" },
  "architecture-decisions": { index: 3, label: "Architecture" },
  prd: { index: 4, label: "PRD" },
  diagrams: { index: 5, label: "Diagrams" },
  "build-plan": { index: 6, label: "Build Plan" },
  complete: { index: 6, label: "Complete" },
};

const TOTAL_STAGES = 6;

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-yellow/20", text: "text-yellow", label: "Pending" },
  "in-progress": { bg: "bg-blue/20", text: "text-blue", label: "In Progress" },
  "gate-review": { bg: "bg-accent/20", text: "text-accent", label: "Gate Review" },
  approved: { bg: "bg-green/20", text: "text-green", label: "Approved" },
};

/* ───────────── Stats Bar ───────────── */

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

const StatCard: Component<StatCardProps> = (props) => {
  return (
    <div class="bg-surface border border-border rounded-lg p-4 flex flex-col gap-1">
      <span class="text-xs text-text-dim uppercase tracking-wide">{props.label}</span>
      <span class={`text-2xl font-bold ${props.color}`}>{props.value}</span>
    </div>
  );
};

/** Helper to get count for a specific status from tasksByStatus */
function getStatusCount(stats: SummaryStats, status: string): number {
  const found = stats.tasksByStatus.find((s: StatusCount) => s.status === status);
  return found?.count ?? 0;
}

/** Calculate total tasks from tasksByStatus array */
function getTotalTasks(stats: SummaryStats): number {
  return stats.tasksByStatus.reduce((sum: number, s: StatusCount) => sum + s.count, 0);
}

const StatsBar: Component<{ stats: SummaryStats; projectCount: number }> = (props) => {
  return (
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <StatCard label="Total Reports" value={props.stats.totalReports} color="text-text" />
      <StatCard label="Total Agents" value={props.stats.totalAgents} color="text-blue" />
      <StatCard label="In Progress" value={getStatusCount(props.stats, "in_progress")} color="text-accent" />
      <StatCard label="Total Tasks" value={getTotalTasks(props.stats)} color="text-green" />
    </div>
  );
};

/* ───────────── Project Card ───────────── */

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
}

const ProjectCard: Component<ProjectCardProps> = (props) => {
  const stage = createMemo(() => STAGE_LABELS[props.project.currentStage]);
  const statusStyle = createMemo(() => STATUS_COLORS[props.project.status]);

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    props.onSelect(props.project);
  };

  return (
    <A
      href={`/project/${props.project.slug}`}
      class="bg-surface border border-border rounded-lg p-4 hover:border-accent transition-colors cursor-pointer block"
      onClick={handleClick}
    >
      {/* Header: title + priority */}
      <div class="flex items-start justify-between mb-3">
        <h3 class="text-sm font-semibold text-text leading-tight">{props.project.title}</h3>
        <span class="text-xs text-text-dim ml-2 shrink-0">#{props.project.priority}</span>
      </div>

      {/* Stage label */}
      <div class="flex items-center gap-2 mb-3">
        <span class="text-xs text-text-dim">Stage {stage()?.index ?? "?"}/{TOTAL_STAGES}:</span>
        <span class="text-xs font-medium text-text">{stage()?.label ?? "Unknown"}</span>
      </div>

      {/* Stage progress dots */}
      <div class="flex gap-1 mb-3">
        <For each={[1, 2, 3, 4, 5, 6]}>
          {(i) => (
            <div
              class={`h-1.5 flex-1 rounded-full ${
                i <= (stage()?.index ?? 0) ? "bg-accent" : "bg-border"
              }`}
            />
          )}
        </For>
      </div>

      {/* Status badge */}
      <span
        class={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusStyle()?.bg ?? ""} ${statusStyle()?.text ?? ""}`}
      >
        {statusStyle()?.label ?? props.project.status}
      </span>
    </A>
  );
};

/* ───────────── Activity Feed ───────────── */

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

const EVENT_BADGE_COLORS: Record<string, string> = {
  task_complete: "text-green",
  delegation: "text-accent",
  research: "text-blue",
  schema_update: "text-yellow",
  recruitment: "text-accent",
  eval_run: "text-green",
  gate_review: "text-yellow",
  ci_run: "text-blue",
  task_start: "text-blue",
};

const ActivityFeed: Component<{ activity: SessionEvent[] }> = (props) => {
  return (
    <div class="mt-8">
      <h2 class="text-lg font-semibold text-text mb-4">Recent Activity</h2>
      <div class="bg-surface border border-border rounded-lg divide-y divide-border">
        <For each={props.activity}>
          {(entry) => (
            <div class="px-4 py-3 flex items-start gap-4">
              {/* Timestamp */}
              <span class="text-xs text-text-dim font-mono w-[90px] shrink-0 pt-0.5">
                {formatTimestamp(entry.timestamp)}
              </span>

              {/* Agent */}
              <span class="text-xs font-semibold text-accent w-[70px] shrink-0 pt-0.5">
                {entry.agent ?? "System"}
              </span>

              {/* Event type badge */}
              <span
                class={`text-xs px-1.5 py-0.5 rounded bg-white/5 w-[100px] shrink-0 text-center ${
                  EVENT_BADGE_COLORS[entry.eventType ?? ""] ?? "text-text-dim"
                }`}
              >
                {(entry.eventType ?? "unknown").replace(/_/g, " ")}
              </span>

              {/* Content */}
              <span class="text-xs text-text-dim leading-relaxed">
                {truncate(entry.content, 120)}
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

/* ───────────── Dashboard ───────────── */

const Dashboard: Component = () => {
  const { setActiveProject } = useProject();
  const { listProjects, getSummaryStats, getRecentActivity } = useDb();
  const { resolvedArtifactsDir } = useSettings();
  const navigate = useNavigate();

  const [projects, setProjects] = createSignal<Project[]>([]);
  const [stats, setStats] = createSignal<SummaryStats>({
    tasksByStatus: [],
    totalReports: 0,
    totalAgents: 0,
  });
  const [activity, setActivity] = createSignal<SessionEvent[]>([]);

  onMount(async () => {
    // Clear active project when visiting dashboard
    setActiveProject(null);
    const [p, s, a] = await Promise.all([
      listProjects(resolvedArtifactsDir()),
      getSummaryStats(),
      getRecentActivity(10),
    ]);
    setProjects(p);
    setStats(s);
    setActivity(a);
  });

  const handleProjectSelect = (project: Project) => {
    // Set active project in context then navigate
    setActiveProject(project.slug);
    navigate(`/project/${project.slug}`);
  };

  return (
    <div class="p-8 max-w-7xl">
      <h1 class="text-2xl font-bold text-text mb-6">Dashboard</h1>

      <StatsBar stats={stats()} projectCount={projects().length} />

      <h2 class="text-lg font-semibold text-text mb-4">Projects</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <For each={projects()}>
          {(project) => <ProjectCard project={project} onSelect={handleProjectSelect} />}
        </For>
      </div>

      <ActivityFeed activity={activity()} />
    </div>
  );
};

export default Dashboard;
