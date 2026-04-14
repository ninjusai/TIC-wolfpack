import {
  createContext,
  createSignal,
  createMemo,
  useContext,
  type ParentComponent,
  type Accessor,
} from "solid-js";
import { tauriInvoke, TauriUnavailableError } from "../lib/tauri";
import { DEFAULT_SETTINGS } from "../types/settings";
import type { AppSettings } from "../types/settings";

/**
 * Resolves artifactsDir to an absolute path.
 * If artifactsDir is already absolute, returns it directly.
 * Otherwise, combines it with projectRoot.
 */
function resolveArtifactsPath(settings: AppSettings): string {
  const { artifactsDir, projectRoot } = settings;

  // If no artifactsDir, use projectRoot
  if (!artifactsDir) return projectRoot;

  // Check if artifactsDir is already absolute (Unix or Windows)
  if (artifactsDir.startsWith('/') || /^[A-Za-z]:/.test(artifactsDir)) {
    return artifactsDir;
  }

  // Combine with projectRoot (handle trailing slashes)
  const cleanRoot = projectRoot.replace(/[\\/]+$/, '');
  return `${cleanRoot}/${artifactsDir}`;
}

interface SettingsContextValue {
  settings: Accessor<AppSettings>;
  /** Resolved artifactsDir path (absolute) for use in Tauri commands */
  resolvedArtifactsDir: Accessor<string>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  loadSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>();

export const SettingsProvider: ParentComponent = (props) => {
  const [settings, setSettings] = createSignal<AppSettings>({ ...DEFAULT_SETTINGS });

  /** Computed resolved artifacts directory path */
  const resolvedArtifactsDir = createMemo(() => resolveArtifactsPath(settings()));

  /** Load settings from Tauri backend (or keep defaults in browser mode) */
  const loadSettings = async (): Promise<void> => {
    try {
      const loaded = await tauriInvoke<AppSettings>("get_settings");
      setSettings((prev) => ({ ...prev, ...loaded }));
    } catch (err) {
      if (err instanceof TauriUnavailableError) {
        console.debug("[SettingsContext] Tauri unavailable — using defaults");
      } else {
        console.warn("[SettingsContext] Failed to load settings:", err);
      }
    }
  };

  /** Persist settings via Tauri IPC then update local state */
  const updateSettings = async (patch: Partial<AppSettings>): Promise<void> => {
    const merged = { ...settings(), ...patch };
    try {
      await tauriInvoke<void>("update_settings", { settings: merged });
      setSettings(merged);
    } catch (err) {
      if (!(err instanceof TauriUnavailableError)) {
        console.error("[SettingsContext] Failed to persist settings:", err);
        throw err; // Re-throw so UI can show error
      }
      // In browser mode, still update local state
      setSettings(merged);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, resolvedArtifactsDir, updateSettings, loadSettings }}>
      {props.children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
