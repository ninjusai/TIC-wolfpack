import type { Component } from "solid-js";
import { createSignal, onMount, onCleanup } from "solid-js";
import { useProject } from "../contexts/ProjectContext";
import { useDb } from "../contexts/DbContext";
import { useSettings } from "../contexts/SettingsContext";
import MemoryStatusIndicator from "./MemoryStatusIndicator";

const Header: Component = () => {
  const { activeProject } = useProject();
  const { listProjects, getSummaryStats, getRecentActivity, queryAgents } = useDb();
  const { resolvedArtifactsDir } = useSettings();
  const [loading, setLoading] = createSignal(false);

  const handleReload = async () => {
    if (loading()) return;
    setLoading(true);

    try {
      // Refresh all major data queries in parallel
      await Promise.all([
        listProjects(resolvedArtifactsDir()),
        getSummaryStats(),
        getRecentActivity(10),
        queryAgents({}),
      ]);
      console.log("[Header] Data refreshed successfully");

      // Dispatch custom event so views can react
      window.dispatchEvent(new CustomEvent("data-refreshed"));
    } catch (err) {
      console.error("[Header] Reload failed:", err);
    } finally {
      // Ensure spinner runs at least briefly for visual feedback
      setTimeout(() => setLoading(false), 300);
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    // Ctrl+R or F5 triggers reload
    if ((e.ctrlKey && e.key === "r") || e.key === "F5") {
      e.preventDefault();
      handleReload();
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeydown);
  });

  return (
    <header class="h-14 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
      <div class="flex items-center gap-3">
        <MemoryStatusIndicator />
        <h2 class="text-sm font-semibold text-text">
          {activeProject() ? activeProject() : "No Project Selected"}
        </h2>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1 bg-surface border border-border rounded hover:border-accent text-text-dim hover:text-text transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50"
          title="Reload (Ctrl+R)"
          onClick={handleReload}
          disabled={loading()}
        >
          <span
            class={loading() ? "inline-block animate-spin" : "inline-block"}
            style={{ "font-size": "14px", "line-height": "1" }}
          >
            &#x21BB;
          </span>
          <span>{loading() ? "Reloading..." : "Reload"}</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
