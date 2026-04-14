/**
 * Auth detection and token management utilities for PeakProtocol web client.
 *
 * These helpers support the device-bound fallback auth flow (WRK-008).
 */

const TOKEN_KEY = "pp_device_token";

/**
 * Check if the browser supports WebAuthn (PublicKeyCredential API).
 */
export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

/**
 * Retrieve the stored device token from localStorage.
 *
 * @returns The token string, or null if none exists.
 */
export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // localStorage may be unavailable (private browsing, disabled, etc.)
    return null;
  }
}

/**
 * Persist a session token to localStorage as a backup
 * (primary storage is the httpOnly cookie set by the server).
 */
export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Silently fail — cookie is the primary mechanism.
    console.warn("[auth] Could not write token to localStorage");
  }
}

/**
 * Clear the stored session token from localStorage.
 */
export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Silently fail.
  }
}

/**
 * Return the API base URL.
 *
 * Priority:
 * 1. VITE_API_URL env var (set at build time via .env or .env.production)
 * 2. localhost → local Wrangler dev server on port 8787
 * 3. Production fallback → peakprotocol-api Workers deployment
 */
export function getApiBase(): string {
  // Vite inlines import.meta.env values at build time
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== "undefined" && window.location) {
    if (window.location.hostname === "localhost") {
      return "http://localhost:8787";
    }
    // Production fallback when VITE_API_URL is not configured
    return "https://peakprotocol-api.jusbartholomew.workers.dev";
  }
  return "";
}

/**
 * Convert a raw error into a user-friendly message.
 *
 * Network errors (TypeError: Failed to fetch) are replaced with a
 * clear "server unreachable" message that hints at starting the API.
 */
export function friendlyAuthError(err: unknown): string {
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    const base = getApiBase();
    return `Unable to connect to the server at ${base}. Is the API backend running? (Run "npm run dev" in the api package.)`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unknown error";
}
