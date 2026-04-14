import type { Component } from "solid-js";
import { For, Show, createSignal, createMemo, onMount } from "solid-js";
import { useDb } from "../contexts/DbContext";
import type { AgentRow } from "../types/query";

/* ───────────── Agent Card ───────────── */

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-green/20", text: "text-green", label: "Active" },
  idle: { bg: "bg-yellow/20", text: "text-yellow", label: "Idle" },
  offline: { bg: "bg-white/10", text: "text-text-dim", label: "Offline" },
};

function formatDate(iso: string): string {
  if (!iso) return "Never";
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return iso;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function truncate(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

const AgentCard: Component<{ agent: AgentRow }> = (props) => {
  const badge = createMemo(() => STATUS_BADGE[props.agent.status] ?? STATUS_BADGE["offline"]);

  return (
    <div class="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-accent/50 transition-colors">
      {/* Header: name + status badge */}
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-sm font-bold text-accent leading-tight">{props.agent.name}</h3>
          <p class="text-xs text-text-dim mt-0.5">{props.agent.role}</p>
        </div>
        <span
          class={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${badge().bg} ${badge().text}`}
        >
          {badge().label}
        </span>
      </div>

      {/* Reports-to */}
      <Show when={props.agent.reportsTo}>
        <p class="text-xs text-text-dim">
          Reports to: <span class="text-text font-medium">{props.agent.reportsTo}</span>
        </p>
      </Show>

      {/* Description (truncated to ~2 lines) */}
      <Show when={props.agent.description}>
        <p class="text-xs text-text-dim leading-relaxed line-clamp-2" title={props.agent.description}>
          {truncate(props.agent.description, 120)}
        </p>
      </Show>

      {/* Activity Stats */}
      <div class="flex items-center gap-4 pt-2 border-t border-border mt-auto">
        <div class="flex flex-col">
          <span class="text-[10px] text-text-dim uppercase tracking-wide">Tasks</span>
          <span class="text-sm font-semibold text-text">{props.agent.tasksCompleted}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-text-dim uppercase tracking-wide">Reports</span>
          <span class="text-sm font-semibold text-text">{props.agent.reportsCount}</span>
        </div>
        <div class="flex flex-col ml-auto text-right">
          <span class="text-[10px] text-text-dim uppercase tracking-wide">Last Active</span>
          <span class="text-xs font-mono text-text-dim">{formatDate(props.agent.lastActive)}</span>
        </div>
      </div>
    </div>
  );
};

/* ───────────── Agent Roster ───────────── */

const AgentRoster: Component = () => {
  const { queryAgents } = useDb();
  const [agents, setAgents] = createSignal<AgentRow[]>([]);
  const [activeOnly, setActiveOnly] = createSignal(false);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const result = await queryAgents({});
      setAgents(result.rows as AgentRow[]);
    } catch {
      // Fallback handled by DbContext
    } finally {
      setLoading(false);
    }
  });

  const filtered = createMemo(() => {
    if (!activeOnly()) return agents();
    return agents().filter((a) => a.status === "active");
  });

  return (
    <div class="p-8 max-w-7xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-text">Agent Roster</h1>
          <p class="text-text-dim text-sm mt-1">
            {filtered().length} agent{filtered().length !== 1 ? "s" : ""} shown
          </p>
        </div>

        {/* Active-only toggle */}
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <span class="text-sm text-text-dim">Active only</span>
          <button
            role="switch"
            aria-checked={activeOnly()}
            class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              activeOnly() ? "bg-accent" : "bg-border"
            }`}
            onClick={() => setActiveOnly(!activeOnly())}
          >
            <span
              class={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                activeOnly() ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </button>
        </label>
      </div>

      <Show when={!loading()} fallback={<p class="text-text-dim text-sm">Loading agents...</p>}>
        <Show
          when={filtered().length > 0}
          fallback={<p class="text-text-dim text-sm py-12 text-center">No agents found</p>}
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={filtered()}>
              {(agent) => <AgentCard agent={agent} />}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default AgentRoster;
