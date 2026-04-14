/**
 * Typed fetch wrapper for PeakProtocol API (WRK-016).
 *
 * Prepends getApiBase(), adds Authorization: Bearer header,
 * parses JSON, and throws on non-2xx responses.
 */
import { getApiBase, getStoredToken } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Extended options for apiFetch with idempotency support. */
interface ApiFetchOptions extends RequestInit {
  /** Optional unique request ID for idempotent mutation requests. */
  requestId?: string;
}

/**
 * Make an authenticated API request.
 *
 * @param path  API path starting with "/" (e.g. "/api/supplements")
 * @param options  Standard RequestInit overrides plus optional `requestId`
 * @returns Parsed JSON response body typed as T
 * @throws ApiError on non-2xx status
 */
export async function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T> {
  const base = getApiBase();
  const token = getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options?.requestId) {
    headers["X-Request-Id"] = options.requestId;
  }

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      else if (body?.message) message = body.message;
    } catch {
      // Response body wasn't JSON — use default message
    }
    throw new ApiError(res.status, message);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
