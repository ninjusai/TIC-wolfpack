/**
 * Cron trigger handler module (WRK-020).
 *
 * Routes scheduled events to the appropriate handler based on the cron
 * pattern. Each handler is idempotent and safe to run multiple times.
 */

import type { Env } from "../env";
import { checkMissedSupplements } from "./missed-check";
import { generateWeeklyReport } from "./weekly-report";

/**
 * Handle a Cloudflare Workers scheduled event.
 *
 * Called by the `scheduled` export in index.ts. Routes to the correct
 * handler based on `event.cron`.
 */
export async function handleScheduledEvent(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  switch (event.cron) {
    case "*/15 * * * *":
      await checkMissedSupplements(env, ctx);
      break;

    case "0 21 * * 0":
      await generateWeeklyReport(env, ctx);
      break;

    default:
      console.warn(`[CRON] Unknown cron pattern: ${event.cron}`);
  }
}
