import type { Component } from "solid-js";
import { Show, For, createSignal, createMemo, createEffect, on, onMount } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { useProject } from "../contexts/ProjectContext";
import { useDb } from "../contexts/DbContext";
import { useSettings } from "../contexts/SettingsContext";
import ArtifactBrowser from "../components/ArtifactBrowser";
import type { ProjectDetail, PipelineStage } from "../types";

/* ───────────── Status / Mode Badges ───────────── */

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-yellow/20", text: "text-yellow", label: "Pending" },
  "in-progress": { bg: "bg-blue/20", text: "text-blue", label: "In Progress" },
  "gate-review": { bg: "bg-accent/20", text: "text-accent", label: "Gate Review" },
  approved: { bg: "bg-green/20", text: "text-green", label: "Approved" },
};

const MODE_STYLES: Record<string, { bg: string; text: string }> = {
  standard: { bg: "bg-blue/20", text: "text-blue" },
  "fast-track": { bg: "bg-accent/20", text: "text-accent" },
};

const PriorityBadge: Component<{ priority: number }> = (props) => {
  return (
    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-white/10 text-text-dim">
      #{props.priority}
    </span>
  );
};

const StatusBadge: Component<{ status: string }> = (props) => {
  const style = createMemo(() => STATUS_COLORS[props.status]);
  return (
    <span
      class={`inline-block px-2 py-0.5 rounded text-xs font-medium ${style()?.bg ?? ""} ${style()?.text ?? ""}`}
    >
      {style()?.label ?? props.status}
    </span>
  );
};

const ModeBadge: Component<{ mode: string }> = (props) => {
  const style = createMemo(() => MODE_STYLES[props.mode] ?? MODE_STYLES["standard"]);
  return (
    <span
      class={`inline-block px-2 py-0.5 rounded text-xs font-medium ${style()?.bg ?? ""} ${style()?.text ?? ""}`}
    >
      {props.mode}
    </span>
  );
};

/* ───────────── Pipeline Stage Node ───────────── */

const STAGE_STATUS_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  complete: { border: "border-green", bg: "bg-green/10", icon: "\u2713" },
  "in-progress": { border: "border-accent", bg: "bg-accent/10", icon: "\u25B6" },
  pending: { border: "border-border", bg: "bg-surface", icon: "\u25CB" },
};

const GATE_STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  passed: { bg: "bg-green/20", text: "text-green", icon: "\u2713" },
  failed: { bg: "bg-red/20", text: "text-red", icon: "\u2717" },
  pending: { bg: "bg-white/5", text: "text-text-dim", icon: "\u2500" },
};

const StageNode: Component<{ stage: PipelineStage; isCurrent: boolean }> = (props) => {
  const style = createMemo(() => STAGE_STATUS_STYLES[props.stage.status] ?? STAGE_STATUS_STYLES["pending"]);
  return (
    <div
      class={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border-2 min-w-[110px] transition-all ${style().border} ${style().bg} ${
        props.isCurrent ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""
      }`}
    >
      <span class="text-lg">{style().icon}</span>
      <span class="text-xs font-semibold text-text text-center">{props.stage.name}</span>
      <span class="text-[10px] text-text-dim">{props.stage.agent}</span>
    </div>
  );
};

const GateConnector: Component<{ gate: PipelineStage["gate"]; index: number }> = (props) => {
  const style = createMemo(() => GATE_STATUS_STYLES[props.gate.status] ?? GATE_STATUS_STYLES["pending"]);
  return (
    <div class="flex flex-col items-center gap-0.5 mx-1">
      <div class="flex items-center gap-1">
        <div class="w-4 h-0.5 bg-border" />
        <div
          class={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${style().bg} ${style().text}`}
          title={`Gate G${props.index + 1}: ${props.gate.status} (${props.gate.attempts} attempts)`}
        >
          {style().icon}
        </div>
        <div class="w-4 h-0.5 bg-border" />
      </div>
      <span class="text-[9px] text-text-dim">
        G{props.index + 1}
        <Show when={props.gate.attempts > 0}>
          <span class="ml-0.5">({props.gate.attempts})</span>
        </Show>
      </span>
    </div>
  );
};

/* ───────────── Pipeline Visualization ───────────── */

const PipelineVisualization: Component<{ stages: PipelineStage[]; currentStage: string }> = (props) => {
  return (
    <div class="bg-surface border border-border rounded-lg p-6 mb-6 overflow-x-auto">
      <h2 class="text-sm font-semibold text-text-dim uppercase tracking-wide mb-4">Pipeline</h2>
      <div class="flex items-center justify-start min-w-max">
        <For each={props.stages}>
          {(stage, i) => {
            const stageKey = stage.name.toLowerCase().replace(/\s+/g, "-");
            const isCurrent = (): boolean => stageKey === props.currentStage;
            return (
              <>
                <StageNode stage={stage} isCurrent={isCurrent()} />
                <Show when={i() < props.stages.length - 1}>
                  <GateConnector gate={stage.gate} index={i()} />
                </Show>
              </>
            );
          }}
        </For>
      </div>
    </div>
  );
};

/* ───────────── Discrepancy Warning ───────────── */

const DiscrepancyWarning: Component = () => {
  return (
    <div class="bg-yellow/10 border border-yellow/30 rounded-lg px-4 py-3 mb-6 flex items-center gap-3">
      <span class="text-yellow text-lg">&#9888;</span>
      <div>
        <p class="text-sm font-semibold text-yellow">Discrepancy Detected</p>
        <p class="text-xs text-text-dim">
          Manifest data conflicts with database records. Review project configuration to resolve.
        </p>
      </div>
    </div>
  );
};

/* ───────────── Project Header ───────────── */

const ProjectHeader: Component<{ project: ProjectDetail }> = (props) => {
  return (
    <div class="mb-6">
      <A href="/" class="text-sm text-accent hover:underline mb-3 inline-block">
        &larr; All Projects
      </A>

      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-text mb-2">{props.project.title}</h1>
          <p class="text-sm text-text-dim font-mono">{props.project.slug}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={props.project.priority} />
          <StatusBadge status={props.project.status} />
          <ModeBadge mode={props.project.mode} />
        </div>
      </div>
    </div>
  );
};

/* ───────────── Project View ───────────── */

const ProjectView: Component = () => {
  const params = useParams<{ slug: string }>();
  const { setActiveProject } = useProject();
  const { getProject } = useDb();
  const { resolvedArtifactsDir } = useSettings();

  const [project, setProject] = createSignal<ProjectDetail | null>(null);
  const [loading, setLoading] = createSignal(true);

  createEffect(
    on(
      () => params.slug,
      async (slug) => {
        setActiveProject(slug ?? null);
        setLoading(true);
        try {
          const p = await getProject(resolvedArtifactsDir(), slug);
          setProject(p);
        } catch {
          setProject(null);
        } finally {
          setLoading(false);
        }
      },
    ),
  );

  return (
    <div class="p-8 max-w-7xl">
      <Show when={!loading()} fallback={<p class="text-text-dim text-sm">Loading project...</p>}>
        <Show
          when={project()}
          fallback={
            <div class="text-center py-16">
              <p class="text-text-dim text-lg mb-4">Project not found: {params.slug}</p>
              <A href="/" class="text-accent hover:underline text-sm">
                &larr; Back to Dashboard
              </A>
            </div>
          }
        >
          {(proj) => (
            <>
              <ProjectHeader project={proj()} />
              <Show when={proj().hasDiscrepancy}>
                <DiscrepancyWarning />
              </Show>
              <PipelineVisualization stages={proj().stages} currentStage={proj().currentStage} />

              {/* Artifact Panel */}
              <div class="mt-6">
                <h2 class="text-sm font-semibold text-text-dim uppercase tracking-wide mb-3">
                  Artifacts
                </h2>
                <div class="h-[500px]">
                  <ArtifactBrowser projectSlug={proj().slug} artifactsDir={resolvedArtifactsDir()} />
                </div>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default ProjectView;
