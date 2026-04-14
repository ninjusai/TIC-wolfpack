/**
 * API integration tests for training sessions.
 * Covers EVL-08: Training session with detailed exercises stores correctly.
 * Covers EVL-08a: Weekly summary aggregates correctly.
 *
 * Requires a running dev server: cd peakprotocol/packages/api && npx wrangler dev --local
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TestClient } from "../helpers/api-client";
import {
  createTestTrainingSession,
  createTestBjjSession,
  createTestCardioSession,
} from "../helpers/fixtures";

const client = new TestClient();

beforeAll(async () => {
  await client.getDeviceToken();
});

// ── Helpers ─────────────────────────────────────────────────────────

/** Get the Monday of the week containing the given date. */
function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function getDateInWeek(mondayStr: string, dayOffset: number): string {
  const d = new Date(mondayStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

// ── EVL-08: Multi-Modal Training Logs ───────────────────────────────

describe("EVL-08: Training Session Storage", () => {
  it("stores a weight training session with exercise details", async () => {
    const session = await client.createTrainingSession(
      createTestTrainingSession({
        date: "2026-03-30",
        type: "weights",
        durationMinutes: 60,
        details: {
          exercises: [
            { name: "Squat", sets: 3, reps: 5, weight: "225lbs" },
            { name: "Bench Press", sets: 3, reps: 5, weight: "185lbs" },
          ],
        },
      }),
    );

    expect(session.id).toBeTruthy();
    expect(session.type).toBe("weights");
    expect(session.durationMinutes).toBe(60);
    expect(session.details).not.toBeNull();

    const exercises = (session.details as Record<string, unknown>)["exercises"] as Array<Record<string, unknown>>;
    expect(exercises).toHaveLength(2);
    expect(exercises[0]!["name"]).toBe("Squat");
    expect(exercises[1]!["name"]).toBe("Bench Press");
  });

  it("stores a BJJ session with intensity and notes", async () => {
    const session = await client.createTrainingSession(
      createTestBjjSession({ date: "2026-04-01" }),
    );

    expect(session.type).toBe("bjj");
    expect(session.durationMinutes).toBe(90);
    expect(session.intensity).toBe("high");
    expect(session.notes).toContain("guard passing");
  });

  it("stores a walk/cardio session with distance details", async () => {
    const session = await client.createTrainingSession(
      createTestCardioSession({ date: "2026-04-03" }),
    );

    expect(session.type).toBe("walk");
    expect(session.durationMinutes).toBe(45);
    expect(session.details).not.toBeNull();
    expect((session.details as Record<string, unknown>)["distanceMiles"]).toBe(3);
  });
});

// ── EVL-08a: Weekly Summary Aggregation ─────────────────────────────

describe("EVL-08a: Weekly Training Summary", () => {
  it("aggregates multiple session types into weekly summary", async () => {
    // Use a known test week
    const monday = getMondayOfWeek("2026-04-06"); // Week of April 6
    const wednesday = getDateInWeek(monday, 2);
    const friday = getDateInWeek(monday, 4);

    // Log 3 different session types across the week
    await client.createTrainingSession(
      createTestTrainingSession({ date: monday, type: "weights", durationMinutes: 60 }),
    );
    await client.createTrainingSession(
      createTestBjjSession({ date: wednesday, durationMinutes: 90 }),
    );
    await client.createTrainingSession(
      createTestCardioSession({ date: friday, durationMinutes: 45 }),
    );

    // Get weekly summary
    const summary = await client.getWeeklySummary(monday);

    expect(summary.sessions.length).toBeGreaterThanOrEqual(3);
    expect(summary.summary.sessionCount).toBeGreaterThanOrEqual(3);
    expect(summary.summary.totalDuration).toBeGreaterThanOrEqual(195); // 60 + 90 + 45

    // Verify byType breakdown
    expect(summary.summary.byType).toHaveProperty("weights");
    expect(summary.summary.byType).toHaveProperty("bjj");
    expect(summary.summary.byType).toHaveProperty("walk");
  });
});
