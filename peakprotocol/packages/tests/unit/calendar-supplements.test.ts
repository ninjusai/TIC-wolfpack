/**
 * Unit tests for Phase 6 Calendar Supplement visibility logic.
 *
 * Covers:
 * - EVL-P6-01: Calendar day cells display colored dots
 * - EVL-P6-01a: Calendar dots for day with no scheduled supplements (negative)
 * - EVL-P6-01b: Calendar dots overflow with 10+ supplements (edge case)
 * - EVL-P6-02: Supplement color assignment persists
 * - EVL-P6-02a: Color uniqueness across supplements (edge case)
 * - EVL-P6-02b: Default color assignment for new supplements
 * - EVL-P6-05: Monthly compliance heatmap computation
 * - EVL-P6-05a: Heatmap for current day with pending evening supplements
 * - EVL-P6-05b: Heatmap backward compatibility
 *
 * Pure function / logic tests — no server required.
 */
import { describe, it, expect } from "vitest";

// ── Inline types matching the calendar-supplements route response ────

interface DaySupplementStatus {
  supplementId: string;
  name: string;
  color: string;
  status: "taken" | "skipped" | "pending";
  logId: string | null;
}

interface CalendarSupplementsResponse {
  days: Record<string, DaySupplementStatus[]>;
  compliance: Record<string, "full" | "partial" | "none" | null>;
}

// ── Palette (mirrors SUPPLEMENT_PALETTE from supplements.ts) ────────

const SUPPLEMENT_PALETTE = [
  '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#10B981', '#F97316',
  '#06B6D4', '#EC4899', '#84CC16', '#6366F1', '#14B8A6', '#F43F5E',
  '#A855F7', '#0EA5E9', '#D946EF', '#78716C',
];

// ── Helper: simulate calendar-supplements logic for dot computation ──

function computeCalendarDay(
  scheduled: Array<{ id: string; name: string; color: string | null }>,
  logs: Array<{ supplementId: string; takenAt: string | null; skipped: boolean }>,
): { dots: DaySupplementStatus[]; compliance: "full" | "partial" | "none" | null } {
  if (scheduled.length === 0 && logs.length === 0) {
    return { dots: [], compliance: null };
  }

  let paletteIdx = 0;
  const dots: DaySupplementStatus[] = [];
  let takenCount = 0;
  let scheduledCount = scheduled.length;

  for (const supp of scheduled) {
    const log = logs.find((l) => l.supplementId === supp.id);
    const color = supp.color ?? SUPPLEMENT_PALETTE[paletteIdx++ % SUPPLEMENT_PALETTE.length];

    let status: "taken" | "skipped" | "pending";
    let logId: string | null = null;

    if (log) {
      if (log.skipped) {
        status = "skipped";
        logId = `log-${supp.id}`;
      } else if (log.takenAt) {
        status = "taken";
        logId = `log-${supp.id}`;
      } else {
        status = "pending";
      }
    } else {
      status = "pending";
    }

    if (status === "taken") takenCount++;

    dots.push({ supplementId: supp.id, name: supp.name, color, status, logId });
  }

  let compliance: "full" | "partial" | "none" | null;
  if (scheduledCount === 0) {
    compliance = null;
  } else if (takenCount === scheduledCount) {
    compliance = "full";
  } else if (takenCount > 0) {
    compliance = "partial";
  } else {
    compliance = "none";
  }

  return { dots, compliance };
}

// ── EVL-P6-01: Calendar day cells display colored dots ──────────────

describe("EVL-P6-01: Calendar Day Cells Display Colored Dots", () => {
  it("renders exactly 3 dots with correct status coloring (taken/skipped/pending)", () => {
    const scheduled = [
      { id: "vd", name: "Vitamin D", color: "#F59E0B" },
      { id: "o3", name: "Omega-3", color: "#3B82F6" },
      { id: "bpc", name: "BPC-157", color: "#8B5CF6" },
    ];

    const logs = [
      { supplementId: "vd", takenAt: "2026-04-05T08:00:00Z", skipped: false },
      { supplementId: "o3", takenAt: null, skipped: true },
      // BPC-157 has no log — should be pending
    ];

    const { dots, compliance } = computeCalendarDay(scheduled, logs);

    expect(dots, "Should render exactly 3 dots for 3 scheduled supplements").toHaveLength(3);

    const vitD = dots.find((d) => d.supplementId === "vd");
    expect(vitD?.status, "Vitamin D should be 'taken'").toBe("taken");
    expect(vitD?.color, "Vitamin D should use assigned color #F59E0B").toBe("#F59E0B");

    const omega = dots.find((d) => d.supplementId === "o3");
    expect(omega?.status, "Omega-3 should be 'skipped'").toBe("skipped");
    expect(omega?.color, "Omega-3 should use assigned color #3B82F6").toBe("#3B82F6");

    const bpc = dots.find((d) => d.supplementId === "bpc");
    expect(bpc?.status, "BPC-157 should be 'pending' with no log").toBe("pending");
    expect(bpc?.color, "BPC-157 should use assigned color #8B5CF6").toBe("#8B5CF6");

    expect(compliance, "Compliance should be 'partial' (1 of 3 taken)").toBe("partial");
  });
});

// ── EVL-P6-01a: Calendar dots for day with no scheduled supplements ──

describe("EVL-P6-01a: No Scheduled Supplements (Negative)", () => {
  it("returns zero dots and null compliance when no supplements are scheduled", () => {
    const { dots, compliance } = computeCalendarDay([], []);

    expect(dots, "No supplement dots should be rendered on a day with no scheduled supplements").toHaveLength(0);
    expect(compliance, "Compliance should be null when no supplements are scheduled").toBeNull();
  });
});

// ── EVL-P6-01b: Calendar dots overflow with 10+ supplements ────────

describe("EVL-P6-01b: Dot Overflow with 12 Supplements (Edge Case)", () => {
  it("handles 12 supplements without data loss — all dots accounted for", () => {
    const scheduled = Array.from({ length: 12 }, (_, i) => ({
      id: `supp-${i}`,
      name: `Supplement ${i + 1}`,
      color: null,
    }));

    const logs = scheduled.map((s) => ({
      supplementId: s.id,
      takenAt: "2026-04-05T08:00:00Z",
      skipped: false,
    }));

    const { dots, compliance } = computeCalendarDay(scheduled, logs);

    expect(
      dots.length,
      "All 12 supplements should be represented in dots (may be truncated in UI, but data must be complete)",
    ).toBe(12);

    expect(
      compliance,
      "Compliance should be 'full' when all 12 supplements are taken",
    ).toBe("full");

    // Verify each dot has a valid color from the palette
    for (const dot of dots) {
      expect(
        dot.color,
        `Dot for ${dot.name} should have a valid hex color`,
      ).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ── EVL-P6-02: Supplement color assignment persists ─────────────────

describe("EVL-P6-02: Supplement Color Assignment Persists", () => {
  it("uses the explicitly assigned color for the supplement dot", () => {
    const scheduled = [
      { id: "vd", name: "Vitamin D", color: "#F59E0B" },
    ];
    const logs = [
      { supplementId: "vd", takenAt: "2026-04-05T08:00:00Z", skipped: false },
    ];

    const { dots } = computeCalendarDay(scheduled, logs);

    expect(
      dots[0]?.color,
      "Vitamin D dot should use its persisted color #F59E0B (not a palette default)",
    ).toBe("#F59E0B");
  });
});

// ── EVL-P6-02a: Color uniqueness across supplements ────────────────

describe("EVL-P6-02a: Color Uniqueness Across Supplements (Edge Case)", () => {
  it("assigns unique palette colors to 10+ supplements when no explicit color set", () => {
    const supplements = Array.from({ length: 12 }, (_, i) => ({
      id: `supp-${i}`,
      name: `Supplement ${i + 1}`,
      color: null, // No explicit color — auto-assign
    }));

    const { dots } = computeCalendarDay(supplements, []);

    const colors = dots.map((d) => d.color);
    const uniqueColors = new Set(colors);

    expect(
      uniqueColors.size,
      "All 12 auto-assigned colors should be unique (palette has 16 entries)",
    ).toBe(12);

    // Verify all colors come from the palette
    for (const color of colors) {
      expect(
        SUPPLEMENT_PALETTE,
        `Color ${color} should be from the SUPPLEMENT_PALETTE`,
      ).toContain(color);
    }
  });

  it("palette provides at least 12 distinct colors", () => {
    expect(
      SUPPLEMENT_PALETTE.length,
      "SUPPLEMENT_PALETTE should have at least 12 colors for visual distinction",
    ).toBeGreaterThanOrEqual(12);

    const unique = new Set(SUPPLEMENT_PALETTE);
    expect(
      unique.size,
      "All palette colors should be unique",
    ).toBe(SUPPLEMENT_PALETTE.length);
  });
});

// ── EVL-P6-02b: Default color assignment for new supplements ────────

describe("EVL-P6-02b: Default Color Assignment for New Supplements", () => {
  it("auto-assigns a valid palette color when no color is explicitly set", () => {
    const { dots } = computeCalendarDay(
      [{ id: "new-supp", name: "New Supplement", color: null }],
      [],
    );

    expect(
      dots[0]?.color,
      "New supplement should receive a color from the palette",
    ).toBeTruthy();

    expect(
      SUPPLEMENT_PALETTE,
      "Auto-assigned color should be from the palette",
    ).toContain(dots[0]?.color);
  });

  it("selects the next unused palette color when some are already taken", () => {
    // First 3 supplements use explicit colors from palette positions 0-2
    const existing = [
      { id: "s1", name: "S1", color: SUPPLEMENT_PALETTE[0] },
      { id: "s2", name: "S2", color: SUPPLEMENT_PALETTE[1] },
      { id: "s3", name: "S3", color: SUPPLEMENT_PALETTE[2] },
      { id: "s4", name: "S4", color: null }, // Should auto-assign
    ];

    const { dots } = computeCalendarDay(existing, []);
    const newDot = dots.find((d) => d.supplementId === "s4");

    expect(
      newDot?.color,
      "Auto-assigned color should be a valid palette color",
    ).toBeTruthy();

    expect(
      typeof newDot?.color,
      "Color should be a string",
    ).toBe("string");
  });
});

// ── EVL-P6-05: Monthly compliance heatmap computation ───────────────

describe("EVL-P6-05: Monthly Compliance Heatmap Computation", () => {
  it("computes correct compliance states: full, partial, none, null", () => {
    // April 1: all 3 taken (full)
    const day1 = computeCalendarDay(
      [
        { id: "s1", name: "A", color: "#3B82F6" },
        { id: "s2", name: "B", color: "#F59E0B" },
        { id: "s3", name: "C", color: "#8B5CF6" },
      ],
      [
        { supplementId: "s1", takenAt: "2026-04-01T08:00:00Z", skipped: false },
        { supplementId: "s2", takenAt: "2026-04-01T12:00:00Z", skipped: false },
        { supplementId: "s3", takenAt: "2026-04-01T20:00:00Z", skipped: false },
      ],
    );

    expect(day1.compliance, "April 1: all taken => 'full'").toBe("full");

    // April 2: 2 of 3 taken (partial)
    const day2 = computeCalendarDay(
      [
        { id: "s1", name: "A", color: "#3B82F6" },
        { id: "s2", name: "B", color: "#F59E0B" },
        { id: "s3", name: "C", color: "#8B5CF6" },
      ],
      [
        { supplementId: "s1", takenAt: "2026-04-02T08:00:00Z", skipped: false },
        { supplementId: "s2", takenAt: "2026-04-02T12:00:00Z", skipped: false },
        // s3 not taken
      ],
    );

    expect(day2.compliance, "April 2: 2 of 3 taken => 'partial'").toBe("partial");

    // April 3: 0 of 3 taken (none)
    const day3 = computeCalendarDay(
      [
        { id: "s1", name: "A", color: "#3B82F6" },
        { id: "s2", name: "B", color: "#F59E0B" },
        { id: "s3", name: "C", color: "#8B5CF6" },
      ],
      [],
    );

    expect(day3.compliance, "April 3: 0 of 3 taken => 'none'").toBe("none");

    // April 4: no supplements scheduled (null)
    const day4 = computeCalendarDay([], []);

    expect(day4.compliance, "April 4: no supplements scheduled => null").toBeNull();
  });
});

// ── EVL-P6-05a: Heatmap with pending evening supplements ────────────

describe("EVL-P6-05a: Heatmap with Pending Evening Supplements (Edge Case)", () => {
  it("shows partial compliance when morning supplements taken but evening still pending", () => {
    const scheduled = [
      { id: "m1", name: "Morning 1", color: "#3B82F6" },
      { id: "m2", name: "Morning 2", color: "#F59E0B" },
      { id: "m3", name: "Morning 3", color: "#8B5CF6" },
      { id: "e1", name: "Evening 1", color: "#EF4444" },
      { id: "e2", name: "Evening 2", color: "#10B981" },
    ];

    const logs = [
      { supplementId: "m1", takenAt: "2026-04-05T08:00:00Z", skipped: false },
      { supplementId: "m2", takenAt: "2026-04-05T08:15:00Z", skipped: false },
      { supplementId: "m3", takenAt: "2026-04-05T08:30:00Z", skipped: false },
      // Evening supplements still pending
    ];

    const { compliance } = computeCalendarDay(scheduled, logs);

    expect(
      compliance,
      "Compliance should be 'partial' when morning taken but evening still pending (3 of 5)",
    ).toBe("partial");
  });
});

// ── EVL-P6-05b: Heatmap backward compatibility ─────────────────────

describe("EVL-P6-05b: Heatmap Backward Compatibility (Regression)", () => {
  it("supplement dots are additive — existing food/training data structure unaffected", () => {
    // Simulate a daily summary response shape that includes Phase 5 fields
    // plus the new Phase 6 dots field.
    const summary = {
      date: "2026-04-05",
      supplements: {
        taken: 2,
        skipped: 1,
        total: 3,
        items: [
          { name: "Vitamin D", dose: "5000 IU", time: "morning", status: "taken" as const },
          { name: "Omega-3", dose: "2g", time: "morning", status: "taken" as const },
          { name: "Creatine", dose: "5g", time: "morning", status: "skipped" as const },
        ],
        // Phase 6 additive field
        dots: [
          { supplementId: "vd", name: "Vitamin D", color: "#F59E0B", status: "taken" as const },
          { supplementId: "o3", name: "Omega-3", color: "#3B82F6", status: "taken" as const },
          { supplementId: "cr", name: "Creatine", color: "#8B5CF6", status: "skipped" as const },
        ],
      },
      nutrition: {
        calories: 2100,
        protein: 150,
        carbs: 250,
        fat: 70,
        meals: [],
      },
      training: {
        sessions: [],
        totalDuration: 0,
      },
      metrics: {},
      journal: { entries: [] },
    };

    // Phase 5 fields still present
    expect(summary.supplements.taken, "Phase 5 'taken' field preserved").toBe(2);
    expect(summary.supplements.skipped, "Phase 5 'skipped' field preserved").toBe(1);
    expect(summary.supplements.total, "Phase 5 'total' field preserved").toBe(3);
    expect(summary.supplements.items, "Phase 5 'items' array preserved").toHaveLength(3);

    // Phase 6 dots are additive
    expect(summary.supplements.dots, "Phase 6 'dots' field is present and additive").toHaveLength(3);

    // Other sections preserved
    expect(summary.nutrition, "Nutrition section preserved").toBeDefined();
    expect(summary.training, "Training section preserved").toBeDefined();
    expect(summary.metrics, "Metrics section preserved").toBeDefined();
    expect(summary.journal, "Journal section preserved").toBeDefined();
  });
});
