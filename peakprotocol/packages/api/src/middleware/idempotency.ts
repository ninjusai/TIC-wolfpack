/**
 * Idempotency middleware for mutation requests (POST/PUT/DELETE).
 *
 * When a client sends an `X-Request-Id` header, this middleware will:
 *   1. Check KV for a cached response keyed by `idempotency:{requestId}`
 *   2. If found  — return the cached response without executing the handler
 *   3. If absent — execute the handler, then cache the response for 5 minutes
 *
 * Requests without `X-Request-Id` pass through unchanged.
 *
 * KV schema:
 *   key:   idempotency:{requestId}
 *   value: JSON { status, headers, body }
 *   TTL:   300 seconds
 */

import { createMiddleware } from "hono/factory";
import type { Env, Variables } from "../env";
import type { SessionData } from "../services/session";

/** Shape of the cached response stored in KV. */
interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const MUTATION_METHODS = new Set(["POST", "PUT", "DELETE"]);
const TTL_SECONDS = 300; // 5 minutes

export const idempotency = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  // Only apply to mutation methods
  if (!MUTATION_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  const requestId = c.req.header("X-Request-Id");

  // No header or invalid format — pass through without idempotency
  if (!requestId || requestId.length > 128 || !/^[\w-]+$/.test(requestId)) {
    await next();
    return;
  }

  // Scope key to user session to prevent cross-user leakage
  const session = c.get("session") as SessionData | undefined;
  const scope = session?.userId ?? "anon";
  const kvKey = `idempotency:${scope}:${requestId}`;

  // Check for a cached response
  const cached = await c.env.KV.get<CachedResponse>(kvKey, "json");

  if (cached) {
    // Return the cached response without executing the handler
    return new Response(cached.body, {
      status: cached.status,
      headers: cached.headers,
    });
  }

  // Execute the handler
  await next();

  // Cache only successful responses (2xx) — transient errors should not be persisted
  const resBody = await c.res.text();

  if (c.res.status >= 200 && c.res.status < 300) {
    const resHeaders: Record<string, string> = {};
    c.res.headers.forEach((value, key) => {
      resHeaders[key] = value;
    });

    const toCache: CachedResponse = {
      status: c.res.status,
      headers: resHeaders,
      body: resBody,
    };

    await c.env.KV.put(kvKey, JSON.stringify(toCache), {
      expirationTtl: TTL_SECONDS,
    });
  }

  // Replace c.res since we consumed the body with .text()
  c.res = new Response(resBody, {
    status: c.res.status,
    headers: c.res.headers,
  });
});
