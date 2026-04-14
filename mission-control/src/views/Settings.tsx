import type { Component } from "solid-js";
import { createSignal, Show, onMount } from "solid-js";
import { useSettings } from "../contexts/SettingsContext";
import { DEFAULT_SETTINGS } from "../types/settings";
import { isTauri, tauriInvoke } from "../lib/tauri";
import type { AppSettings } from "../types/settings";

/* ───────────── Toggle Switch ───────────── */

const Toggle: Component<{ checked: boolean; onChange: (v: boolean) => void }> = (props) => {
  return (
    <button
      role="switch"
      aria-checked={props.checked}
      class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        props.checked ? "bg-accent" : "bg-border"
      }`}
      onClick={() => props.onChange(!props.checked)}
    >
      <span
        class={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          props.checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
};

/* ───────────── Settings View ───────────── */

const Settings: Component = () => {
  const { settings, updateSettings, loadSettings } = useSettings();

  const [dbPath, setDbPath] = createSignal(DEFAULT_SETTINGS.dbPath);
  const [projectRoot, setProjectRoot] = createSignal(DEFAULT_SETTINGS.projectRoot);
  const [artifactsDir, setArtifactsDir] = createSignal(DEFAULT_SETTINGS.artifactsDir);
  const [fileWatcher, setFileWatcher] = createSignal(DEFAULT_SETTINGS.fileWatcherEnabled);
  const [toast, setToast] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  // Load current settings on mount
  onMount(async () => {
    try {
      await loadSettings();
    } catch {
      // ignore — will use defaults
    }
    const s = settings();
    setDbPath(s.dbPath);
    setProjectRoot(s.projectRoot);
    setArtifactsDir(s.artifactsDir);
    setFileWatcher(s.fileWatcherEnabled);
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  /**
   * Open native file dialog for selecting a database file
   */
  const selectDbFile = async () => {
    if (!isTauri()) {
      showToast("File picker requires Tauri runtime");
      return;
    }
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        title: "Select Database File",
        filters: [{ name: "Database", extensions: ["db", "sqlite", "sqlite3"] }],
        multiple: false,
      });
      if (path && typeof path === "string") {
        setDbPath(path);
      }
    } catch (err) {
      console.warn("[Settings] Failed to open file dialog:", err);
      showToast("Failed to open file picker");
    }
  };

  /**
   * Open native directory picker for project root or artifacts directory
   */
  const selectDirectory = async (setter: (val: string) => void, title: string) => {
    if (!isTauri()) {
      showToast("Directory picker requires Tauri runtime");
      return;
    }
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        title,
        directory: true,
        multiple: false,
      });
      if (path && typeof path === "string") {
        setter(path);
      }
    } catch (err) {
      console.warn("[Settings] Failed to open directory dialog:", err);
      showToast("Failed to open directory picker");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: Partial<AppSettings> = {
        dbPath: dbPath(),
        projectRoot: projectRoot(),
        artifactsDir: artifactsDir(),
        fileWatcherEnabled: fileWatcher(),
      };
      await updateSettings(patch);
      showToast("Settings saved successfully");
    } catch {
      showToast("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Save settings AND reinitialize database connection without app restart
   */
  const handleSaveAndReconnect = async () => {
    setSaving(true);
    try {
      const patch: Partial<AppSettings> = {
        dbPath: dbPath(),
        projectRoot: projectRoot(),
        artifactsDir: artifactsDir(),
        fileWatcherEnabled: fileWatcher(),
      };
      await updateSettings(patch);

      // Reinitialize database connection with new settings
      if (isTauri()) {
        try {
          const result = await tauriInvoke<string>("reinit_database");
          showToast(result);
        } catch (err) {
          const errStr = err instanceof Error ? err.message : String(err);
          showToast(`Settings saved but DB error: ${errStr}`);
        }
      } else {
        showToast("Settings saved (reconnect requires Tauri)");
      }
    } catch {
      showToast("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDbPath(DEFAULT_SETTINGS.dbPath);
    setProjectRoot(DEFAULT_SETTINGS.projectRoot);
    setArtifactsDir(DEFAULT_SETTINGS.artifactsDir);
    setFileWatcher(DEFAULT_SETTINGS.fileWatcherEnabled);
    showToast("Settings reset to defaults");
  };

  const inputClass =
    "flex-1 bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:border-accent focus:outline-none";
  const labelClass = "text-sm font-medium text-text-dim w-40 shrink-0 pt-2";

  return (
    <div class="p-8 max-w-3xl">
      <h1 class="text-2xl font-bold text-text mb-1">Settings</h1>
      <p class="text-text-dim text-sm mb-8">Configure application paths and behavior.</p>

      {/* Toast */}
      <Show when={toast()}>
        <div class="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded shadow-lg text-sm font-medium">
          {toast()}
        </div>
      </Show>

      <div class="space-y-6">
        {/* Database Path */}
        <div class="flex items-start gap-4">
          <label class={labelClass}>Database Path</label>
          <div class="flex flex-1 gap-2">
            <input
              type="text"
              class={inputClass}
              value={dbPath()}
              onInput={(e) => setDbPath(e.currentTarget.value)}
              placeholder="wolfpack.db"
            />
            <button
              class="px-3 py-2 bg-surface border border-border rounded text-sm text-text-dim hover:text-text hover:border-accent transition-colors"
              onClick={selectDbFile}
            >
              Browse...
            </button>
          </div>
        </div>

        {/* Project Root */}
        <div class="flex items-start gap-4">
          <label class={labelClass}>Project Root</label>
          <div class="flex flex-1 gap-2">
            <input
              type="text"
              class={inputClass}
              value={projectRoot()}
              onInput={(e) => setProjectRoot(e.currentTarget.value)}
              placeholder="."
            />
            <button
              class="px-3 py-2 bg-surface border border-border rounded text-sm text-text-dim hover:text-text hover:border-accent transition-colors"
              onClick={() => selectDirectory(setProjectRoot, "Select Project Root")}
            >
              Browse...
            </button>
          </div>
        </div>

        {/* Artifacts Directory */}
        <div class="flex items-start gap-4">
          <label class={labelClass}>Artifacts Directory</label>
          <div class="flex flex-1 gap-2">
            <input
              type="text"
              class={inputClass}
              value={artifactsDir()}
              onInput={(e) => setArtifactsDir(e.currentTarget.value)}
              placeholder="artifacts"
            />
            <button
              class="px-3 py-2 bg-surface border border-border rounded text-sm text-text-dim hover:text-text hover:border-accent transition-colors"
              onClick={() => selectDirectory(setArtifactsDir, "Select Artifacts Directory")}
            >
              Browse...
            </button>
          </div>
        </div>

        {/* File Watcher Toggle */}
        <div class="flex items-center gap-4">
          <label class={labelClass}>File Watcher</label>
          <div class="flex items-center gap-3">
            <Toggle checked={fileWatcher()} onChange={setFileWatcher} />
            <span class="text-sm text-text-dim">
              {fileWatcher() ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div class="border-t border-border" />

        {/* Action buttons */}
        <div class="flex items-center gap-3">
          <button
            class="px-5 py-2 bg-accent text-white font-medium rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
            onClick={handleSaveAndReconnect}
            disabled={saving()}
          >
            {saving() ? "Applying..." : "Apply & Reconnect"}
          </button>
          <button
            class="px-5 py-2 bg-surface border border-border text-text-dim font-medium rounded hover:text-text hover:border-accent transition-colors disabled:opacity-50"
            onClick={handleSave}
            disabled={saving()}
          >
            Save Only
          </button>
          <button
            class="px-5 py-2 bg-surface border border-border text-text-dim font-medium rounded hover:text-text hover:border-accent transition-colors"
            onClick={handleReset}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
