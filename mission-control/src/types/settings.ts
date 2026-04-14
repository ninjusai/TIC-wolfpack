/** Types for application settings */

export interface AppSettings {
  /** UI theme */
  theme: "dark";
  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Path to the wolfpack.db SQLite database */
  dbPath: string;
  /** Root directory of the project repository */
  projectRoot: string;
  /** Directory containing project artifacts */
  artifactsDir: string;
  /** Whether the file watcher is enabled */
  fileWatcherEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  sidebarCollapsed: false,
  dbPath: "wolfpack.db",
  projectRoot: ".",
  artifactsDir: "artifacts",
  fileWatcherEnabled: true,
};
