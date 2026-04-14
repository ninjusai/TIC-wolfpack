/**
 * Type-safe environment bindings for the Cloudflare Worker.
 *
 * All bindings configured in wrangler.toml are represented here.
 * Secrets (VAPID keys) are set via `wrangler secret put`.
 */
import type { SessionData } from "./services/session";

/**
 * Hono Variables accessible via c.get() / c.set().
 * Populated by middleware (e.g. requireSession).
 */
export type Variables = {
  session: SessionData;
};

export type Env = {
  /** D1 database — all queries MUST use prepared statements */
  DB: D1Database;
  /** KV namespace — sessions, cache, ephemeral data */
  KV: KVNamespace;
  /** R2 bucket — file/image storage */
  BUCKET: R2Bucket;
  /** VAPID private key for web push notifications */
  VAPID_PRIVATE_KEY: string;
  /** VAPID public key for web push notifications */
  VAPID_PUBLIC_KEY: string;
  /** USDA FoodData Central API key (Wrangler secret) */
  USDA_API_KEY: string;
  /** Single-user passcode for simple auth (Wrangler secret) */
  APP_PASSCODE: string;
  /** Anthropic API key for AI macro estimation via Claude Haiku (Wrangler secret) */
  ANTHROPIC_API_KEY: string;
};
