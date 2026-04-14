/**
 * Missed supplement notification check (WRK-020).
 *
 * Runs every 15 minutes via cron trigger. Queries active supplements,
 * calculates daily compliance, and sends push notifications for any
 * newly missed doses. Uses KV for deduplication to ensure idempotency.
 */

import type { Env } from "../env";
import { formatDate } from "../lib/dates";
import { getTodaySchedule } from "../services/scheduler";
import { calculateDailyCompliance } from "../services/compliance";
import type { SupplementLogRow } from "../services/compliance";
import type { SchedulableSupplement } from "../services/scheduler";
import { sendPushNotification } from "../services/push";

/** Raw supplement row from D1. */
interface SupplementRow {
  id: string;
  name: string;
  schedule_type: string;
  schedule_value: string | null;
  time_of_day: string;
  active: number;
  created_at: string;
}

/**
 * Check for missed supplements and send push notifications.
 *
 * Idempotent: uses KV keys with 24h TTL to avoid duplicate notifications.
 */
export async function checkMissedSupplements(env: Env, ctx: ExecutionContext): Promise<void> {
  const now = new Date();
  const todayStr = formatDate(now);

  // 1. Query all active supplements from D1
  const { results: supplementRows } = await env.DB.prepare(
    "SELECT id, name, schedule_type, schedule_value, time_of_day, active, created_at FROM supplements WHERE active = 1"
  ).all<SupplementRow>();

  if (!supplementRows || supplementRows.length === 0) {
    console.log("[CRON:missed-check] No active supplements found");
    return;
  }

  // Map D1 rows to SchedulableSupplement for the scheduler
  const supplements: SchedulableSupplement[] = supplementRows.map((row) => ({
    id: row.id,
    name: row.name,
    scheduleType: row.schedule_type,
    scheduleValue: row.schedule_value ? JSON.parse(row.schedule_value) : null,
    timeOfDay: row.time_of_day,
    active: row.active === 1,
    createdAt: row.created_at,
  }));

  // 2. Get today's schedule via scheduler
  const occurrences = getTodaySchedule(supplements, todayStr);

  if (occurrences.length === 0) {
    console.log("[CRON:missed-check] No occurrences scheduled for today");
    return;
  }

  // 3. Get today's logs from D1
  const { results: logRows } = await env.DB.prepare(
    "SELECT id, supplement_id, scheduled_date, scheduled_time, taken_at, actual_dose, skipped, notes FROM supplement_logs WHERE scheduled_date = ?"
  ).bind(todayStr).all<SupplementLogRow>();

  const logs = logRows ?? [];

  // 4. Use compliance service to calculate daily compliance
  const summary = calculateDailyCompliance(occurrences, logs, todayStr, now);

  // 5. Find items with status "missed"
  const missedItems = summary.items.filter((item) => item.status === "missed");

  if (missedItems.length === 0) {
    console.log("[CRON:missed-check] No missed supplements");
    return;
  }

  // 6 & 7. For each missed item, check KV and send notification if new
  let notificationsSent = 0;

  for (const item of missedItems) {
    const kvKey = `last_notification:${item.supplementId}:${todayStr}`;

    // Check if we already notified for this supplement today
    const existing = await env.KV.get(kvKey);
    if (existing) {
      continue; // Already notified — skip for idempotency
    }

    // Send push notification
    const sent = await sendPushNotification(env, {
      title: "Missed Supplement",
      body: `Missed: ${item.supplementName} \u2014 Tap to log`,
      tag: `missed-${item.supplementId}-${todayStr}`,
      data: {
        type: "missed_supplement",
        supplementId: item.supplementId,
        date: todayStr,
      },
    });

    if (sent) {
      // Set KV with 24h TTL to prevent duplicate notifications
      await env.KV.put(kvKey, "1", { expirationTtl: 86400 });
      notificationsSent++;
    }
  }

  console.log(
    `[CRON:missed-check] Processed ${missedItems.length} missed, sent ${notificationsSent} notifications`
  );
}
