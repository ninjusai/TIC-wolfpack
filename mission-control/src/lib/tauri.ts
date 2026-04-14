/**
 * Tauri IPC helper with graceful fallback for browser-only development.
 *
 * When running via `vite dev` (no Tauri shell), invoke() is unavailable.
 * This module detects that and lets callers fall back to mock data.
 */

/** Returns true when the app is running inside a Tauri webview */
export const isTauri = (): boolean => '__TAURI__' in window;

/**
 * Wrapper around Tauri's invoke that throws a typed TauriUnavailableError
 * when Tauri is not present so callers can catch and fall back.
 */
export class TauriUnavailableError extends Error {
  constructor() {
    super('Tauri runtime is not available');
    this.name = 'TauriUnavailableError';
  }
}

/**
 * Invoke a Tauri command. Returns the typed result on success.
 * Throws TauriUnavailableError when running in browser-only mode.
 */
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new TauriUnavailableError();
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

/**
 * Listen for a Tauri event. No-op when Tauri is not available.
 * Returns an unlisten function (or a no-op).
 */
export async function tauriListen<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  if (!isTauri()) {
    return () => {};
  }
  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<T>(event, (e) => handler(e.payload));
  return unlisten;
}
