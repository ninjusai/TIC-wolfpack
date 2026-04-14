/**
 * Hono middleware that gates routes behind a valid KV session.
 *
 * Token extraction order:
 *   1. `Authorization: Bearer {token}` header
 *   2. `session` cookie
 *
 * On success the full SessionData is available via `c.get("session")`.
 */

import { createMiddleware } from "hono/factory";
import type { Env, Variables } from "../env";
import { getSession } from "../services/session";
import { parseSessionCookie } from "../lib/cookies";

export const requireSession = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  // 1. Extract token
  const authHeader = c.req.header("Authorization");
  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token) {
    // Fall back to cookie
    const cookieHeader = c.req.header("Cookie");
    if (cookieHeader) {
      const parsed = parseSessionCookie(cookieHeader);
      if (parsed) {
        token = parsed;
      }
    }
  }

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // 2. Validate session
  const session = await getSession(c.env.KV, token);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // 3. Attach to context and continue
  c.set("session", session);
  await next();
});
