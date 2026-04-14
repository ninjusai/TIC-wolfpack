/**
 * Daily Metrics page (WRK-030).
 *
 * Weight tracking, hydration tracking, and daily notes.
 * Mobile-first with touch-friendly controls and optimistic UI.
 */
import {
  createSignal,
  createResource,
  createEffect,
  Show,
  For,
  on,
  type Component,
} from "solid-js";
import {
  getMetrics,
  updateMetrics,
  formatDate,
  shiftDate,
  convertWeight,
  type DailyMetrics,
  type MetricsUpdateData,
} from "../lib/metrics";
import WeightChart from "../components/WeightChart";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const QUICK_ADD_OPTIONS = [
  { label: "+250ml", amount: 250 },
  { label: "+500ml", amount: 500 },
  { label: "+glass", amount: 330 },
];

const DEFAULT_WATER_TARGET = 3000;

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const Metrics: Component = () => {
  /* ---- Date navigation ---- */
  const [selectedDate, setSelectedDate] = createSignal(formatDate(new Date()));
  const isToday = () => selectedDate() === formatDate(new Date());

  const goBack = () => setSelectedDate(shiftDate(selectedDate(), -1));
  const goForward = () => setSelectedDate(shiftDate(selectedDate(), 1));
  const goToday = () => setSelectedDate(formatDate(new Date()));

  /* ---- Fetch metrics for selected date ---- */
  const [metrics, { refetch, mutate }] = createResource(selectedDate, (date) =>
    getMetrics(date),
  );

  /* ---- Weight state ---- */
  const [weightInput, setWeightInput] = createSignal("");
  const [weightUnit, setWeightUnit] = createSignal<"kg" | "lbs">("kg");
  const [savingWeight, setSavingWeight] = createSignal(false);
  const [weightError, setWeightError] = createSignal("");
  const [weightSaved, setWeightSaved] = createSignal(false);

  /* ---- Hydration state ---- */
  const [waterMl, setWaterMl] = createSignal(0);
  const [waterTarget, setWaterTarget] = createSignal(DEFAULT_WATER_TARGET);
  const [customWaterInput, setCustomWaterInput] = createSignal("");
  const [editingTarget, setEditingTarget] = createSignal(false);
  const [targetInput, setTargetInput] = createSignal("");
  const [savingWater, setSavingWater] = createSignal(false);
  const [waterError, setWaterError] = createSignal("");

  /* ---- Notes & Tags state ---- */
  const [notes, setNotes] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [tagInput, setTagInput] = createSignal("");
  const [savingNotes, setSavingNotes] = createSignal(false);
  const [notesSaved, setNotesSaved] = createSignal(false);

  /* ---- Sync form state from fetched metrics ---- */
  createEffect(
    on(
      () => metrics(),
      (m) => {
        if (m) {
          setWeightInput(m.weight != null ? String(m.weight) : "");
          setWeightUnit((m.weightUnit as "kg" | "lbs") || "kg");
          setWaterMl(m.waterMl ?? 0);
          setWaterTarget(m.waterTargetMl ?? DEFAULT_WATER_TARGET);
          setNotes(m.notes ?? "");
          setTags(m.tags ?? []);
        } else {
          setWeightInput("");
          setWeightUnit("kg");
          setWaterMl(0);
          setWaterTarget(DEFAULT_WATER_TARGET);
          setNotes("");
          setTags([]);
        }
        setWeightError("");
        setWaterError("");
        setWeightSaved(false);
        setNotesSaved(false);
      },
    ),
  );

  /* ---- Weight save ---- */
  const saveWeight = async () => {
    setSavingWeight(true);
    setWeightError("");
    setWeightSaved(false);
    try {
      const val = weightInput().trim() === "" ? null : parseFloat(weightInput());
      if (val !== null && isNaN(val)) {
        setWeightError("Invalid number");
        return;
      }
      await updateMetrics(selectedDate(), {
        weight: val,
        weightUnit: weightUnit(),
      });
      setWeightSaved(true);
      setTimeout(() => setWeightSaved(false), 2000);
      refetch();
    } catch {
      setWeightError("Failed to save");
    } finally {
      setSavingWeight(false);
    }
  };

  const toggleUnit = () => {
    const current = weightUnit();
    const next = current === "kg" ? "lbs" : "kg";
    const val = parseFloat(weightInput());
    if (!isNaN(val)) {
      setWeightInput(String(convertWeight(val, current, next)));
    }
    setWeightUnit(next);
  };

  /* ---- Hydration quick-add (optimistic) ---- */
  const addWater = async (amount: number) => {
    const prev = waterMl();
    const newAmount = prev + amount;
    // Optimistic update
    setWaterMl(newAmount);
    setSavingWater(true);
    setWaterError("");
    try {
      await updateMetrics(selectedDate(), { waterMl: newAmount });
      // Silently update the underlying resource cache
      mutate((m) =>
        m ? { ...m, waterMl: newAmount } : m,
      );
    } catch {
      // Revert on failure
      setWaterMl(prev);
      setWaterError("Failed to save water intake");
    } finally {
      setSavingWater(false);
    }
  };

  const addCustomWater = () => {
    const val = parseInt(customWaterInput(), 10);
    if (!isNaN(val) && val > 0) {
      addWater(val);
      setCustomWaterInput("");
    }
  };

  const saveWaterTarget = async () => {
    const val = parseInt(targetInput(), 10);
    if (isNaN(val) || val <= 0) return;
    setWaterTarget(val);
    setEditingTarget(false);
    try {
      await updateMetrics(selectedDate(), { waterTargetMl: val });
    } catch {
      setWaterError("Failed to save target");
    }
  };

  /* ---- Notes & Tags save ---- */
  const handleAddTag = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput().trim().replace(/,$/g, "");
      if (val && !tags().includes(val)) {
        setTags([...tags(), val]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags().filter((t) => t !== tag));
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      await updateMetrics(selectedDate(), {
        notes: notes() || null,
        tags: tags(),
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      // silent fail
    } finally {
      setSavingNotes(false);
    }
  };

  /* ---- Hydration helpers ---- */
  const waterPercent = () => {
    const target = waterTarget();
    if (target <= 0) return 0;
    return Math.min(100, Math.round((waterMl() / target) * 100));
  };

  const waterBarColor = () => {
    const pct = waterPercent();
    if (pct >= 100) return "bg-green-500 dark:bg-green-400";
    if (pct >= 75) return "bg-blue-500 dark:bg-blue-400";
    if (pct >= 50) return "bg-blue-400 dark:bg-blue-500";
    return "bg-blue-300 dark:bg-blue-600";
  };

  /* ---- Weight delta display ---- */
  const weightDelta = () => {
    const m = metrics();
    if (!m || m.weight == null) return null;
    // We don't have yesterday's data readily available from a single fetch.
    // The delta is shown as a placeholder until WeightChart is integrated.
    return null;
  };

  /* ---- Readable date label ---- */
  const dateLabel = () => {
    if (isToday()) return "Today";
    const d = new Date(selectedDate() + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div class="pb-24 md:pb-8 md:ml-56">
      <div class="max-w-3xl mx-auto px-4 py-6">
        {/* ---- Date Navigation ---- */}
        <div class="flex items-center justify-between mb-6">
          <button
            class="touch-target p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={goBack}
            aria-label="Previous day"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div class="flex items-center gap-3">
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">
              {dateLabel()}
            </h1>
            <input
              type="date"
              value={selectedDate()}
              onInput={(e) => setSelectedDate(e.currentTarget.value)}
              class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            />
            <Show when={!isToday()}>
              <button
                class="touch-target text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                onClick={goToday}
              >
                Today
              </button>
            </Show>
          </div>

          <button
            class="touch-target p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={goForward}
            aria-label="Next day"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* ---- Loading state ---- */}
        <Show when={metrics.loading}>
          <div class="space-y-4">
            <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
              <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48" />
            </div>
            <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4" />
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            </div>
          </div>
        </Show>

        <Show when={!metrics.loading}>
          {/* ============================================================ */}
          {/* WEIGHT SECTION                                               */}
          {/* ============================================================ */}
          <section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-5">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Weight
            </h2>

            {/* Current weight display */}
            <Show when={metrics()?.weight != null}>
              <div class="mb-4">
                <span class="text-4xl font-bold text-gray-900 dark:text-white">
                  {metrics()!.weight}
                </span>
                <span class="text-lg text-gray-500 dark:text-gray-400 ml-1">
                  {metrics()!.weightUnit || "kg"}
                </span>
              </div>
            </Show>

            {/* Weight input */}
            <div class="flex items-center gap-2 mb-3">
              <input
                type="number"
                inputmode="decimal"
                step="0.1"
                placeholder="Enter weight"
                value={weightInput()}
                onInput={(e) => setWeightInput(e.currentTarget.value)}
                class="touch-target flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                class="touch-target px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors min-w-[3rem]"
                onClick={toggleUnit}
                title="Toggle unit"
              >
                {weightUnit()}
              </button>
              <button
                class="touch-target px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                onClick={saveWeight}
                disabled={savingWeight()}
              >
                {savingWeight() ? "..." : weightSaved() ? "Saved" : "Save"}
              </button>
            </div>

            <Show when={weightError()}>
              <p class="text-sm text-red-600 dark:text-red-400 mb-2">{weightError()}</p>
            </Show>

            {/* Weight delta placeholder */}
            <Show when={weightDelta() !== null}>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {weightDelta()}
              </p>
            </Show>

            {/* WeightChart (WRK-029) */}
            <div class="mt-4">
              <WeightChart
                startDate={shiftDate(selectedDate(), -30)}
                endDate={selectedDate()}
                unit={weightUnit()}
              />
            </div>
          </section>

          {/* ============================================================ */}
          {/* HYDRATION SECTION                                            */}
          {/* ============================================================ */}
          <section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-5">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                Hydration
              </h2>
              <Show when={savingWater()}>
                <span class="text-xs text-blue-500 dark:text-blue-400 animate-pulse">
                  Saving...
                </span>
              </Show>
            </div>

            {/* Progress display */}
            <div class="mb-4">
              <div class="flex items-end gap-1 mb-2">
                <span class="text-3xl font-bold text-gray-900 dark:text-white">
                  {waterMl()}
                </span>
                <span class="text-base text-gray-500 dark:text-gray-400 pb-0.5">
                  / {waterTarget()} ml
                </span>
                <span class="text-sm text-gray-400 dark:text-gray-500 pb-0.5 ml-1">
                  ({waterPercent()}%)
                </span>
              </div>

              {/* Progress bar */}
              <div class="h-4 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  class={`h-full rounded-full transition-all duration-300 ease-out ${waterBarColor()}`}
                  style={{ width: `${waterPercent()}%` }}
                />
              </div>
            </div>

            {/* Quick-add buttons */}
            <div class="flex flex-wrap gap-2 mb-4">
              <For each={QUICK_ADD_OPTIONS}>
                {(opt) => (
                  <button
                    class="touch-target px-4 py-2 rounded-lg text-sm font-medium border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    onClick={() => addWater(opt.amount)}
                  >
                    {opt.label}
                  </button>
                )}
              </For>
            </div>

            {/* Custom amount */}
            <div class="flex items-center gap-2 mb-4">
              <input
                type="number"
                inputmode="numeric"
                placeholder="Custom ml"
                value={customWaterInput()}
                onInput={(e) => setCustomWaterInput(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomWater();
                }}
                class="touch-target flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                class="touch-target px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                onClick={addCustomWater}
              >
                Add
              </button>
            </div>

            {/* Water target editing */}
            <div class="text-sm">
              <Show
                when={editingTarget()}
                fallback={
                  <button
                    class="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    onClick={() => {
                      setTargetInput(String(waterTarget()));
                      setEditingTarget(true);
                    }}
                  >
                    Target: {waterTarget()} ml (edit)
                  </button>
                }
              >
                <div class="flex items-center gap-2">
                  <span class="text-gray-600 dark:text-gray-400">Target:</span>
                  <input
                    type="number"
                    inputmode="numeric"
                    value={targetInput()}
                    onInput={(e) => setTargetInput(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveWaterTarget();
                      if (e.key === "Escape") setEditingTarget(false);
                    }}
                    class="touch-target w-24 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <span class="text-gray-500 dark:text-gray-400">ml</span>
                  <button
                    class="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                    onClick={saveWaterTarget}
                  >
                    Save
                  </button>
                  <button
                    class="text-gray-500 dark:text-gray-400 hover:underline"
                    onClick={() => setEditingTarget(false)}
                  >
                    Cancel
                  </button>
                </div>
              </Show>
            </div>

            <Show when={waterError()}>
              <p class="text-sm text-red-600 dark:text-red-400 mt-2">{waterError()}</p>
            </Show>
          </section>

          {/* ============================================================ */}
          {/* NOTES & TAGS SECTION                                         */}
          {/* ============================================================ */}
          <section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-5">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Notes
            </h2>

            <textarea
              placeholder="How are you feeling today?"
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
              rows={3}
              class="touch-target w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            />

            {/* Tags */}
            <div class="mt-3">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags
              </label>
              <div class="flex flex-wrap gap-1.5 mb-2">
                <For each={tags()}>
                  {(tag) => (
                    <span class="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 text-xs font-medium">
                      {tag}
                      <button
                        type="button"
                        class="hover:text-red-500 transition-colors"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                      >
                        x
                      </button>
                    </span>
                  )}
                </For>
              </div>
              <input
                type="text"
                placeholder="Add tag (Enter or comma to add)"
                value={tagInput()}
                onInput={(e) => setTagInput(e.currentTarget.value)}
                onKeyDown={handleAddTag}
                class="touch-target w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div class="flex items-center gap-2 mt-3">
              <button
                class="touch-target px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                onClick={saveNotes}
                disabled={savingNotes()}
              >
                {savingNotes() ? "Saving..." : notesSaved() ? "Saved" : "Save Notes"}
              </button>
            </div>
          </section>
        </Show>
      </div>
    </div>
  );
};

export default Metrics;
