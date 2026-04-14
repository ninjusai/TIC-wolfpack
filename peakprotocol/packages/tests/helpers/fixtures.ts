/**
 * Test data factories for PeakProtocol eval harness.
 *
 * Each factory returns a complete, valid data object suitable for API
 * creation endpoints. Pass an `overrides` partial to customise individual
 * fields while keeping defaults for everything else.
 */

// ── Supplement ──────────────────────────────────────────────────────

interface CreateSupplementData {
  name: string;
  currentDose?: string;
  unit?: string;
  scheduleType?: "daily" | "every_n_days" | "weekly" | "specific_days";
  scheduleValue?: Record<string, unknown>;
  timeOfDay?: "morning" | "evening" | "with_food" | "anytime";
  tags?: string[];
}

export function createTestSupplement(overrides?: Partial<CreateSupplementData>): CreateSupplementData {
  return {
    name: "Vitamin D",
    currentDose: "5000",
    unit: "IU",
    scheduleType: "daily",
    timeOfDay: "morning",
    tags: ["vitamin"],
    ...overrides,
  };
}

/**
 * Create a supplement configured for every-N-days scheduling.
 */
export function createEveryNDaysSupplement(
  n: number,
  startDate: string,
  overrides?: Partial<CreateSupplementData>,
): CreateSupplementData {
  return createTestSupplement({
    name: `Every-${n}-days Supplement`,
    scheduleType: "every_n_days",
    scheduleValue: { n, startDate },
    ...overrides,
  });
}

/**
 * Create a supplement configured for weekly scheduling.
 */
export function createWeeklySupplement(
  day: string,
  overrides?: Partial<CreateSupplementData>,
): CreateSupplementData {
  return createTestSupplement({
    name: `Weekly ${day} Supplement`,
    scheduleType: "weekly",
    scheduleValue: { day },
    ...overrides,
  });
}

// ── Food Entry ──────────────────────────────────────────────────────

interface CreateFoodEntryData {
  date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  foodName: string;
  fdcId?: string;
  servingSize?: number;
  servingUnit?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

export function createTestFoodEntry(overrides?: Partial<CreateFoodEntryData>): CreateFoodEntryData {
  return {
    date: "2026-04-01",
    meal: "lunch",
    foodName: "Chicken Breast",
    servingSize: 200,
    servingUnit: "g",
    calories: 330,
    protein: 62,
    carbs: 0,
    fat: 7,
    fiber: 0,
    ...overrides,
  };
}

// ── Training Session ────────────────────────────────────────────────

interface CreateTrainingSessionData {
  date: string;
  type: "weights" | "bjj" | "cardio" | "walk";
  durationMinutes?: number;
  intensity?: "low" | "medium" | "high";
  details?: Record<string, unknown>;
  notes?: string;
}

export function createTestTrainingSession(
  overrides?: Partial<CreateTrainingSessionData>,
): CreateTrainingSessionData {
  return {
    date: "2026-04-01",
    type: "weights",
    durationMinutes: 60,
    intensity: "high",
    details: {
      exercises: [
        { name: "Squat", sets: 3, reps: 5, weight: "225lbs" },
        { name: "Bench Press", sets: 3, reps: 5, weight: "185lbs" },
      ],
    },
    notes: "Heavy compound day",
    ...overrides,
  };
}

export function createTestBjjSession(overrides?: Partial<CreateTrainingSessionData>): CreateTrainingSessionData {
  return createTestTrainingSession({
    type: "bjj",
    durationMinutes: 90,
    intensity: "high",
    details: { focus: "guard passing" },
    notes: "Focused on guard passing",
    ...overrides,
  });
}

export function createTestCardioSession(overrides?: Partial<CreateTrainingSessionData>): CreateTrainingSessionData {
  return createTestTrainingSession({
    type: "walk",
    durationMinutes: 45,
    intensity: "low",
    details: { distanceMiles: 3 },
    notes: "Evening walk",
    ...overrides,
  });
}

// ── Journal Entry ───────────────────────────────────────────────────

interface CreateJournalEntryData {
  date: string;
  content: string;
  tags?: string[];
}

export function createTestJournalEntry(overrides?: Partial<CreateJournalEntryData>): CreateJournalEntryData {
  return {
    date: "2026-04-01",
    content: "Felt great today. Energy levels were high after morning supplements.",
    tags: ["energy", "mood"],
    ...overrides,
  };
}

// ── Daily Metrics ───────────────────────────────────────────────────

interface MetricsUpdateData {
  weight?: number;
  weightUnit?: "kg" | "lbs";
  waterMl?: number;
  waterTargetMl?: number;
  notes?: string;
  tags?: string[];
}

export function createTestMetrics(overrides?: Partial<MetricsUpdateData>): MetricsUpdateData {
  return {
    weight: 184.5,
    weightUnit: "lbs",
    waterMl: 2500,
    waterTargetMl: 3000,
    ...overrides,
  };
}

// ── Weight time-series for trend tests ──────────────────────────────

/**
 * Generate 14 days of weight data with a downward trend.
 * Returns array of { date, weight } pairs.
 */
export function createWeightTrendData(
  startDate: string,
  days: number = 14,
): Array<{ date: string; weight: number }> {
  const weights = [
    185.0, 184.8, 185.2, 184.5, 184.3, 184.0, 184.2,
    183.8, 183.5, 183.7, 183.2, 183.0, 182.8, 182.5,
  ];

  const result: Array<{ date: string; weight: number }> = [];
  const start = new Date(startDate + "T00:00:00Z");

  for (let i = 0; i < Math.min(days, weights.length); i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    result.push({ date: dateStr, weight: weights[i]! });
  }

  return result;
}

/**
 * Generate N days of macro data for correlation tests.
 */
export function createMacroSeriesData(
  startDate: string,
  days: number = 30,
): Array<{ date: string; calories: number; protein: number; carbs: number; fat: number }> {
  const result: Array<{ date: string; calories: number; protein: number; carbs: number; fat: number }> = [];
  const start = new Date(startDate + "T00:00:00Z");

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    // Vary macros slightly each day for realistic data
    const baseCal = 2200 + Math.sin(i * 0.5) * 300;
    result.push({
      date: dateStr,
      calories: Math.round(baseCal),
      protein: Math.round(150 + Math.sin(i * 0.3) * 30),
      carbs: Math.round(250 + Math.cos(i * 0.4) * 50),
      fat: Math.round(70 + Math.sin(i * 0.7) * 15),
    });
  }

  return result;
}

// ── Dose history scenario ───────────────────────────────────────────

export interface DoseHistoryScenario {
  supplementName: string;
  initialDose: string;
  unit: string;
  changes: Array<{ dose: string; notes?: string }>;
}

export function createDoseTitrationScenario(): DoseHistoryScenario {
  return {
    supplementName: "Testosterone",
    initialDose: "100mg",
    unit: "mg",
    changes: [
      { dose: "125mg", notes: "Week 2 increase" },
      { dose: "150mg", notes: "Week 3 increase" },
      { dose: "175mg", notes: "Week 4 increase" },
    ],
  };
}

// ── Journal entries for search tests ────────────────────────────────

export function createJournalSearchData(): CreateJournalEntryData[] {
  return [
    { date: "2026-03-20", content: "Morning energy was through the roof.", tags: ["energy"] },
    { date: "2026-03-21", content: "Slept 8 hours. Deep sleep quality.", tags: ["sleep"] },
    { date: "2026-03-22", content: "Great mood all day long.", tags: ["mood"] },
    { date: "2026-03-23", content: "Energy dipped in the afternoon.", tags: ["energy"] },
    { date: "2026-03-24", content: "Hard training session today.", tags: ["training"] },
    { date: "2026-03-25", content: "Sleep disrupted by noise.", tags: ["sleep"] },
    { date: "2026-03-26", content: "Mood was neutral today.", tags: ["mood"] },
    { date: "2026-03-27", content: "Great workout energy.", tags: ["energy", "training"] },
    { date: "2026-03-28", content: "Strict diet adherence.", tags: ["diet"] },
    { date: "2026-03-29", content: "Rest day. Good mood.", tags: ["mood", "training"] },
  ];
}
