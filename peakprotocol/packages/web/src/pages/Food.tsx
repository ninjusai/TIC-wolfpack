/**
 * Food Logging page (WRK-026 / WRK-PP6-022 / WRK-PP6-023 / WRK-PP6-024).
 *
 * Daily food diary with meal sections, macro totals, and food search.
 * Phase 6 additions:
 * - Source badges on all entries
 * - Text-only entries with dashed border + italic styling
 * - "Calculate All" button for batch resolution
 * - Tap-to-edit for manual macro override
 * Mobile-first with date navigation mirroring the Metrics page.
 */
import {
  createSignal,
  createResource,
  Show,
  For,
  type Component,
} from "solid-js";
import {
  formatDate,
  shiftDate,
  getDailyEntries,
  deleteFoodEntry,
  calculateAllEntries,
  createTextFoodEntry,
  MEALS,
  MEAL_LABELS,
  type Meal,
  type FoodEntry,
  type DailyTotals,
} from "../lib/food";
import FoodSearch from "../components/FoodSearch";
import SourceBadge from "../components/SourceBadge";
import FoodEntryEdit from "../components/FoodEntryEdit";

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const Food: Component = () => {
  /* ---- Date navigation ---- */
  const [selectedDate, setSelectedDate] = createSignal(formatDate(new Date()));
  const isToday = () => selectedDate() === formatDate(new Date());

  const goBack = () => setSelectedDate(shiftDate(selectedDate(), -1));
  const goForward = () => setSelectedDate(shiftDate(selectedDate(), 1));
  const goToday = () => setSelectedDate(formatDate(new Date()));

  /* ---- Fetch daily entries ---- */
  const [data, { refetch }] = createResource(selectedDate, (date) =>
    getDailyEntries(date),
  );

  const entries = () => data()?.entries ?? [];
  const totals = (): DailyTotals =>
    data()?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

  /* ---- Food search modal ---- */
  const [showSearch, setShowSearch] = createSignal(false);
  const [searchMeal, setSearchMeal] = createSignal<Meal>("breakfast");

  const openSearch = (meal: Meal) => {
    setSearchMeal(meal);
    setShowSearch(true);
  };

  /* ---- Delete entry ---- */
  const [deletingId, setDeletingId] = createSignal<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFoodEntry(id);
      refetch();
    } catch {
      // silent — could add toast later
    } finally {
      setDeletingId(null);
    }
  };

  /* ---- Calculate All (WRK-PP6-022) ---- */
  const [calculating, setCalculating] = createSignal(false);
  const [calcResult, setCalcResult] = createSignal<{ resolved: number; failed: number } | null>(null);

  const unresolvedCount = () =>
    entries().filter((e) => e.calories == null).length;

  const handleCalculateAll = async () => {
    setCalculating(true);
    setCalcResult(null);
    try {
      const result = await calculateAllEntries(selectedDate());
      setCalcResult({ resolved: result.resolved.length, failed: result.failed.length });
      refetch();
    } catch {
      setCalcResult({ resolved: 0, failed: -1 }); // -1 signals total failure
    } finally {
      setCalculating(false);
    }
  };

  /* ---- Edit entry (WRK-PP6-024) ---- */
  const [editingEntry, setEditingEntry] = createSignal<FoodEntry | null>(null);

  /* ---- Quick text entry (always accessible) ---- */
  const [showQuickAdd, setShowQuickAdd] = createSignal(false);
  const [quickText, setQuickText] = createSignal("");
  const [quickMeal, setQuickMeal] = createSignal<Meal>("breakfast");
  const [quickLogging, setQuickLogging] = createSignal(false);
  const [quickError, setQuickError] = createSignal("");

  const handleQuickAdd = async () => {
    const desc = quickText().trim();
    if (!desc) return;

    setQuickLogging(true);
    setQuickError("");
    try {
      await createTextFoodEntry({
        date: selectedDate(),
        meal: quickMeal(),
        description: desc,
      });
      setQuickText("");
      setShowQuickAdd(false);
      refetch();
    } catch {
      setQuickError("Failed to log entry. Try again.");
    } finally {
      setQuickLogging(false);
    }
  };

  /** Whether an entry is text-only (no macros calculated yet). */
  const isTextOnly = (entry: FoodEntry) => entry.calories == null && entry.description != null;

  /* ---- Helpers ---- */
  const entriesForMeal = (meal: string): FoodEntry[] =>
    entries().filter((e) => e.meal === meal);

  const mealCalories = (meal: string): number =>
    entriesForMeal(meal).reduce((sum, e) => sum + (e.calories ?? 0), 0);

  const dateLabel = () => {
    if (isToday()) return "Today";
    const d = new Date(selectedDate() + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const hasAnyEntries = () => entries().length > 0;

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
        <Show when={data.loading}>
          <div class="space-y-4">
            <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            </div>
            <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            </div>
          </div>
        </Show>

        <Show when={!data.loading}>
          {/* ============================================================ */}
          {/* DAILY TOTALS BAR                                             */}
          {/* ============================================================ */}
          <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-5 space-y-3">
            <div class="flex items-center justify-around">
              <div class="text-center">
                <div class="text-lg font-bold text-orange-500">{totals().calories}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Calories</div>
              </div>
              <div class="w-px h-8 bg-gray-200 dark:bg-gray-700" />
              <div class="text-center">
                <div class="text-lg font-bold text-blue-500">{totals().protein}g</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Protein</div>
              </div>
              <div class="w-px h-8 bg-gray-200 dark:bg-gray-700" />
              <div class="text-center">
                <div class="text-lg font-bold text-yellow-500">{totals().carbs}g</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Carbs</div>
              </div>
              <div class="w-px h-8 bg-gray-200 dark:bg-gray-700" />
              <div class="text-center">
                <div class="text-lg font-bold text-red-500">{totals().fat}g</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Fat</div>
              </div>
            </div>

            {/* Calculate All button — shows when unresolved entries exist */}
            <Show when={unresolvedCount() > 0}>
              <div class="border-t border-gray-200 dark:border-gray-700 pt-3">
                <button
                  class="min-h-[44px] w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  onClick={handleCalculateAll}
                  disabled={calculating()}
                >
                  <Show
                    when={!calculating()}
                    fallback={
                      <span class="flex items-center gap-2">
                        <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Calculating...
                      </span>
                    }
                  >
                    Calculate All ({unresolvedCount()} pending)
                  </Show>
                </button>
                <Show when={calcResult()}>
                  {(res) => (
                    <p class="text-xs text-center mt-2">
                      <Show when={res().failed === -1}>
                        <span class="text-red-600 dark:text-red-400">Calculation failed. Try again.</span>
                      </Show>
                      <Show when={res().failed !== -1}>
                        <span class="text-green-600 dark:text-green-400">
                          {res().resolved} resolved
                        </span>
                        <Show when={res().failed > 0}>
                          <span class="text-red-600 dark:text-red-400">
                            {" "}· {res().failed} failed
                          </span>
                        </Show>
                      </Show>
                    </p>
                  )}
                </Show>
              </div>
            </Show>
          </div>

          {/* ============================================================ */}
          {/* QUICK TEXT ENTRY (always accessible)                         */}
          {/* ============================================================ */}
          <Show
            when={showQuickAdd()}
            fallback={
              <button
                class="w-full mb-4 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
                onClick={() => setShowQuickAdd(true)}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Quick text entry
              </button>
            }
          >
            <div class="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 mb-4 space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Quick text entry
                </h4>
                <button
                  class="touch-target p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  onClick={() => { setShowQuickAdd(false); setQuickText(""); setQuickError(""); }}
                  aria-label="Close quick add"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. chicken and rice"
                value={quickText()}
                onInput={(e) => setQuickText(e.currentTarget.value)}
                autofocus
                class="touch-target w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                onKeyDown={(e) => { if (e.key === "Enter" && quickText().trim()) handleQuickAdd(); }}
              />
              <div class="flex flex-wrap gap-2">
                <For each={[...MEALS]}>
                  {(m) => (
                    <button
                      class={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        quickMeal() === m
                          ? "bg-blue-600 text-white dark:bg-blue-500"
                          : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      onClick={() => setQuickMeal(m)}
                    >
                      {MEAL_LABELS[m]}
                    </button>
                  )}
                </For>
              </div>
              <Show when={quickError()}>
                <p class="text-sm text-red-600 dark:text-red-400">{quickError()}</p>
              </Show>
              <button
                class="touch-target w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                onClick={handleQuickAdd}
                disabled={quickLogging() || !quickText().trim()}
              >
                {quickLogging() ? "Saving..." : "Log Entry"}
              </button>
            </div>
          </Show>

          {/* ============================================================ */}
          {/* EMPTY STATE                                                  */}
          {/* ============================================================ */}
          <Show when={!hasAnyEntries()}>
            <div class="text-center py-12">
              <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-gray-500 dark:text-gray-400 mb-4">
                No foods logged today. Tap + to start logging.
              </p>
              <button
                class="touch-target px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                onClick={() => openSearch("breakfast")}
              >
                Add Food
              </button>
            </div>
          </Show>

          {/* ============================================================ */}
          {/* MEAL SECTIONS                                                */}
          {/* ============================================================ */}
          <Show when={hasAnyEntries()}>
            <div class="space-y-4">
              <For each={[...MEALS]}>
                {(mealName) => (
                  <section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                    {/* Sticky meal header */}
                    <div class="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <div class="flex items-center gap-2">
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                          {MEAL_LABELS[mealName]}
                        </h3>
                        <Show when={mealCalories(mealName) > 0}>
                          <span class="text-xs text-gray-500 dark:text-gray-400">
                            {mealCalories(mealName)} cal
                          </span>
                        </Show>
                      </div>
                      <button
                        class="touch-target p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        onClick={() => openSearch(mealName)}
                        aria-label={`Add food to ${mealName}`}
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    </div>

                    {/* Entries */}
                    <Show
                      when={entriesForMeal(mealName).length > 0}
                      fallback={
                        <div class="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">
                          No foods logged
                        </div>
                      }
                    >
                      <ul class="divide-y divide-gray-100 dark:divide-gray-700/50">
                        <For each={entriesForMeal(mealName)}>
                          {(entry) => (
                            <li
                              class={`flex items-center justify-between px-4 py-3 ${
                                isTextOnly(entry)
                                  ? "border-l-2 border-dashed border-gray-300 dark:border-gray-600"
                                  : ""
                              }`}
                            >
                              {/* Tap-to-edit: clicking the food info opens the edit modal */}
                              <button
                                class="flex-1 min-w-0 mr-3 text-left"
                                onClick={() => setEditingEntry(entry)}
                                aria-label={`Edit ${entry.foodName}`}
                              >
                                <div class="flex items-center gap-2">
                                  <span
                                    class={`text-sm font-medium truncate flex-1 ${
                                      isTextOnly(entry)
                                        ? "italic text-gray-500 dark:text-gray-400"
                                        : "text-gray-900 dark:text-white"
                                    }`}
                                  >
                                    {entry.foodName}
                                  </span>
                                  <SourceBadge source={entry.source} />
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  <Show
                                    when={!isTextOnly(entry)}
                                    fallback={
                                      <span class="italic">Pending calculation</span>
                                    }
                                  >
                                    {entry.servingSize ?? "--"}{entry.servingUnit ?? "g"}
                                    {" "}· {entry.calories ?? "--"} cal
                                  </Show>
                                </div>
                              </button>
                              <button
                                class="touch-target p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                onClick={() => handleDelete(entry.id)}
                                disabled={deletingId() === entry.id}
                                aria-label={`Delete ${entry.foodName}`}
                              >
                                <Show
                                  when={deletingId() !== entry.id}
                                  fallback={
                                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                  }
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </Show>
                              </button>
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>
                  </section>
                )}
              </For>
            </div>
          </Show>

          {/* ---- Floating Add Button (when entries exist) ---- */}
          <Show when={hasAnyEntries()}>
            <button
              class="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40 touch-target w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-lg flex items-center justify-center transition-colors"
              onClick={() => openSearch("breakfast")}
              aria-label="Add food"
            >
              <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </Show>
        </Show>

        {/* ---- Food Search Modal ---- */}
        <Show when={showSearch()}>
          <FoodSearch
            date={selectedDate()}
            defaultMeal={searchMeal()}
            onClose={() => setShowSearch(false)}
            onLogged={() => refetch()}
          />
        </Show>

        {/* ---- Food Entry Edit Modal (WRK-PP6-024) ---- */}
        <Show when={editingEntry()}>
          {(entry) => (
            <FoodEntryEdit
              entry={entry()}
              onClose={() => setEditingEntry(null)}
              onSaved={() => refetch()}
            />
          )}
        </Show>
      </div>
    </div>
  );
};

export default Food;
