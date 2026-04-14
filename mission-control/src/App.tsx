import type { Component, ParentComponent } from "solid-js";
import { onMount, onCleanup } from "solid-js";
import { Router, Route } from "@solidjs/router";
import { ProjectProvider } from "./contexts/ProjectContext";
import { DbProvider } from "./contexts/DbContext";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { isTauri, tauriInvoke, tauriListen } from "./lib/tauri";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./views/Dashboard";
import ProjectView from "./views/ProjectView";
import IntakeView from "./views/IntakeView";
import PipelineView from "./views/PipelineView";
import DbExplorer from "./views/DbExplorer";
import AgentRoster from "./views/AgentRoster";
import Settings from "./views/Settings";

/* ───────────── Settings Loader ───────────── */

const SettingsLoader: Component = () => {
  const { loadSettings } = useSettings();

  onMount(async () => {
    await loadSettings();
  });

  return null;
};

/* ───────────── File Watcher ───────────── */

const FileWatcherSetup: Component = () => {
  const { settings } = useSettings();
  let unlistenFn: (() => void) | null = null;

  onMount(() => {
    if (!isTauri()) return;

    const setup = async () => {
      const s = settings();

      // Don't setup watcher if disabled in settings
      if (!s.fileWatcherEnabled) {
        console.debug("[FileWatcher] Disabled in settings, skipping");
        return;
      }

      // Listen for file-changed events from Tauri backend
      try {
        unlistenFn = await tauriListen<{ path: string; kind: string }>(
          "file-changed",
          (payload) => {
            console.log("[FileWatcher] File changed:", payload);
            // Views that need refreshing will re-fetch on their own mount/effect cycles.
            // A global event bus could be added here for fine-grained invalidation.
          },
        );
      } catch (err) {
        console.warn("[FileWatcher] Failed to setup event listener:", err);
        return;
      }

      // Start watching artifacts + db (paths may not exist yet, which is OK)
      try {
        await tauriInvoke("start_watching", {
          artifactsDir: s.artifactsDir,
          dbPath: s.dbPath,
        });
      } catch (err) {
        // Path may not exist yet - this is expected for new projects
        // The watcher can be started later when paths are created
        console.debug("[FileWatcher] Could not start watcher (path may not exist):", err);
      }
    };

    setup();
  });

  onCleanup(() => {
    if (unlistenFn) {
      unlistenFn();
    }
  });

  return null;
};

/* ───────────── Shell Layout ───────────── */

const Shell: ParentComponent = (props) => {
  return (
    <div class="h-screen flex bg-bg text-text font-sans">
      <SettingsLoader />
      <Sidebar />
      <div class="flex-1 flex flex-col min-w-0">
        <Header />
        <main class="flex-1 overflow-auto">
          {props.children}
        </main>
      </div>
      <FileWatcherSetup />
    </div>
  );
};

/* ───────────── App Root ───────────── */

const App: Component = () => {
  return (
    <SettingsProvider>
      <DbProvider>
        <ProjectProvider>
          <Router root={Shell}>
            <Route path="/" component={Dashboard} />
            <Route path="/project/:slug" component={ProjectView} />
            <Route path="/intake" component={IntakeView} />
            <Route path="/pipeline/:slug" component={PipelineView} />
            <Route path="/db" component={DbExplorer} />
            <Route path="/agents" component={AgentRoster} />
            <Route path="/settings" component={Settings} />
          </Router>
        </ProjectProvider>
      </DbProvider>
    </SettingsProvider>
  );
};

export default App;
