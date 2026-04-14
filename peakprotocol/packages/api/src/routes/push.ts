/**
 * Web Push subscription management routes (WRK-019).
 *
 * All routes require an authenticated session.
 * Subscriptions are stored in KV as a single key (`push_subscription`)
 * since PeakProtocol is a single-user app.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";
import { getApplicationServerKey } from "../lib/vapid";

// ── Constants ────────────────────────────────────────────────────────

const KV_KEY = "push_subscription";

// ── Zod Schemas ──────────────────────────────────────────────────────

const PushSubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

// ── Routes ───────────────────────────────────────────────────────────

export const pushRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all push routes
pushRoutes.use("*", requireSession);

/**
 * POST /api/push/subscribe
 *
 * Store a Web Push subscription in KV.
 */
pushRoutes.post("/subscribe", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = PushSubscriptionSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const session = c.get("session");

  await c.env.KV.put(KV_KEY, JSON.stringify(parsed.data.subscription), {
    metadata: { userId: session.userId },
  });

  return c.json({ success: true });
});

/**
 * DELETE /api/push/unsubscribe
 *
 * Remove the stored push subscription from KV.
 */
pushRoutes.delete("/unsubscribe", async (c) => {
  await c.env.KV.delete(KV_KEY);
  return c.json({ success: true });
});

/**
 * GET /api/push/status
 *
 * Check whether a push subscription exists.
 */
pushRoutes.get("/status", async (c) => {
  const value = await c.env.KV.get(KV_KEY);
  return c.json({ subscribed: value !== null });
});

/**
 * GET /api/push/vapid-key
 *
 * Return the VAPID public key (base64url-encoded raw bytes) for the
 * frontend to use as `applicationServerKey`.
 */
pushRoutes.get("/vapid-key", async (c) => {
  const publicKey = await getApplicationServerKey(c.env.VAPID_PUBLIC_KEY);
  return c.json({ publicKey });
});
