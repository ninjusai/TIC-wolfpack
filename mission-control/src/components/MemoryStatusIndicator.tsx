import type { Component } from "solid-js";
import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { tauriInvoke, TauriUnavailableError } from "../lib/tauri";
import { useSettings } from "../contexts/SettingsContext";

interface MemoryStatus {
  pack_state_path: string;
  exists: boolean;
  last_modified: number | null;
  age_minutes: number | null;
  is_stale: boolean;
  threshold_minutes: number;
}

const MemoryStatusIndicator: Component = () => {
  const { settings } = useSettings();
  const [status, setStatus] = createSignal<MemoryStatus | null>(null);

  const checkStatus = async () => {
    const projectRoot = settings().projectRoot;
    if (!projectRoot) {
      setStatus(null);
      return;
    }

    try {
      const result = await tauriInvoke<MemoryStatus>("get_memory_status", {
        projectRoot,
        thresholdMinutes: 15,
      });
      setStatus(result);
    } catch (e) {
      if (e instanceof TauriUnavailableError) {
        // Tauri not available (browser dev mode) - silently skip
        console.debug("[MemoryStatusIndicator] Tauri unavailable, skipping memory check");
      } else {
        console.error("[MemoryStatusIndicator] Failed to check memory status:", e);
      }
      setStatus(null);
    }
  };

  // Check on mount and every 60 seconds
  createEffect(() => {
    // Re-run when projectRoot changes
    const _projectRoot = settings().projectRoot;
    checkStatus();
    const interval = setInterval(checkStatus, 60_000);
    onCleanup(() => clearInterval(interval));
  });

  // Also refresh when data-refreshed event fires
  createEffect(() => {
    const handler = () => checkStatus();
    window.addEventListener("data-refreshed", handler);
    onCleanup(() => window.removeEventListener("data-refreshed", handler));
  });

  return (
    <Show when={status()}>
      {(s) => {
        // Fresh memory: subtle green indicator
        if (!s().is_stale && s().exists) {
          return (
            <div
              class="flex items-center gap-1.5 text-xs text-green"
              title={`Memory fresh (updated ${s().age_minutes}m ago)`}
            >
              <span class="w-2 h-2 rounded-full bg-green" />
              <span class="text-text-dim">Memory OK</span>
            </div>
          );
        }

        // Stale or missing: amber/red warning
        const ageText = s().exists && s().age_minutes !== null
          ? `${s().age_minutes}m ago`
          : "missing";
        const color = s().exists ? "text-yellow" : "text-red";
        const bgColor = s().exists ? "bg-yellow" : "bg-red";

        return (
          <div
            class={`flex items-center gap-1.5 text-xs ${color} cursor-help`}
            title={`PACK_STATE.md ${s().exists ? `last updated ${s().age_minutes}m ago` : 'does not exist'}. Consider spawning Scribe.`}
          >
            <span class={`w-2 h-2 rounded-full ${bgColor} animate-pulse`} />
            <span>Memory Stale ({ageText})</span>
          </div>
        );
      }}
    </Show>
  );
};

export default MemoryStatusIndicator;
