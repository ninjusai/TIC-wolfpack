/**
 * API integration tests for supplement CRUD and scheduling.
 * Covers EVL-03 (API-level scheduling verification) and EVL-04/EVL-04a (dose titration).
 *
 * Requires a running dev server: cd peakprotocol/packages/api && npx wrangler dev --local
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TestClient } from "../helpers/api-client";
import {
  createTestSupplement,
  createEveryNDaysSupplement,
  createWeeklySupplement,
  createDoseTitrationScenario,
} from "../helpers/fixtures";

const client = new TestClient();

beforeAll(async () => {
  await client.getDeviceToken();
});

// ── Supplement CRUD ─────────────────────────────────────────────────

describe("Supplement CRUD", () => {
  let supplementId: string;

  it("creates a supplement with all fields", async () => {
    const data = createTestSupplement();
    const supp = await client.createSupplement(data);

    expect(supp.id).toBeTruthy();
    expect(supp.name).toBe("Vitamin D");
    expect(supp.currentDose).toBe("5000");
    expect(supp.unit).toBe("IU");
    expect(supp.scheduleType).toBe("daily");
    expect(supp.timeOfDay).toBe("morning");
    expect(supp.active).toBe(true);
    expect(supp.tags).toContain("vitamin");

    supplementId = supp.id;
  });

  it("retrieves the created supplement by ID", async () => {
    const supp = await client.getSupplement(supplementId);

    expect(supp.id).toBe(supplementId);
    expect(supp.name).toBe("Vitamin D");
  });

  it("lists supplements with active filter", async () => {
    const supplements = await client.listSupplements({ active: "true" });

    expect(supplements.length).toBeGreaterThanOrEqual(1);
    expect(supplements.every((s) => s.active === true)).toBe(true);
  });

  it("updates a supplement", async () => {
    const updated = await client.updateSupplement(supplementId, {
      currentDose: "10000",
      tags: ["vitamin", "d3"],
    });

    expect(updated.currentDose).toBe("10000");
    expect(updated.tags).toContain("d3");
  });

  it("soft-deletes a supplement (sets active=false)", async () => {
    await client.deleteSupplement(supplementId);
    const supp = await client.getSupplement(supplementId);

    expect(supp.active).toBe(false);
  });
});

// ── EVL-03: Schedule types via API ──────────────────────────────────

describe("EVL-03: Supplement Scheduling via API", () => {
  it("creates a daily supplement", async () => {
    const supp = await client.createSupplement(
      createTestSupplement({ name: "Daily Creatine", scheduleType: "daily" }),
    );

    expect(supp.scheduleType).toBe("daily");
  });

  it("creates an every-N-days supplement", async () => {
    const supp = await client.createSupplement(
      createEveryNDaysSupplement(2, "2026-04-01", { name: "BPC-157" }),
    );

    expect(supp.scheduleType).toBe("every_n_days");
    expect(supp.scheduleValue).toEqual({ n: 2, startDate: "2026-04-01" });
  });

  it("creates a weekly supplement", async () => {
    const supp = await client.createSupplement(
      createWeeklySupplement("sun", { name: "B12 Weekly" }),
    );

    expect(supp.scheduleType).toBe("weekly");
    expect(supp.scheduleValue).toEqual({ day: "sun" });
  });
});

// ── EVL-04: Dose titration records history correctly ────────────────

describe("EVL-04: Dose Titration History", () => {
  const scenario = createDoseTitrationScenario();
  let supplementId: string;

  it("creates a supplement with initial dose", async () => {
    const supp = await client.createSupplement(
      createTestSupplement({
        name: scenario.supplementName,
        currentDose: scenario.initialDose,
        unit: scenario.unit,
      }),
    );

    supplementId = supp.id;
    expect(supp.currentDose).toBe(scenario.initialDose);
  });

  it("records dose changes and preserves history (EVL-04a)", async () => {
    for (const change of scenario.changes) {
      const result = await client.changeDose(supplementId, {
        dose: change.dose,
        notes: change.notes,
      });

      expect(result.supplement.currentDose).toBe(change.dose);
      expect(result.doseChange.supplementId).toBe(supplementId);
    }

    // Verify full history
    const { history, total } = await client.getDoseHistory(supplementId);

    expect(
      total,
      `Expected ${scenario.changes.length} dose change records in history`,
    ).toBe(scenario.changes.length);

    // History is returned in DESC order (most recent first)
    expect(history).toHaveLength(scenario.changes.length);

    // Verify the old doses are preserved in history (EVL-04a)
    // History records the dose BEFORE the change
    const recordedDoses = history.map((h) => h.dose);
    expect(recordedDoses).toContain(scenario.initialDose);
  });
});
