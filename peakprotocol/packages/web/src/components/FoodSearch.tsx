/**
 * Food search modal component (WRK-026 / WRK-PP6-020 / WRK-PP6-021 / WRK-PP6-022).
 *
 * Slide-up panel for searching FDC foods and logging entries.
 * Phase 6 additions:
 * - Multi-source badges (USDA / OFF) on search results
 * - AI estimation fallback when no results found
 * - Text-only entry for deferred calculation
 * Debounced search (300ms), live macro calculation, mobile-first.
 */
import {
  createSignal,
  createEffect,
  on,
  Show,
  For,
  onCleanup,
  type Component,
} from "solid-js";
import {
  searchFoods,
  createFoodEntry,
  createTextFoodEntry,
  estimateFood,
  scaleMacros,
  MEALS,
  MEAL_LABELS,
  type SearchFood,
  type Meal,
  type AIEstimationResponse,
} from "../lib/food";
import { ApiError } from "../lib/api";
import SourceBadge from "./SourceBadge";

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */

interface FoodSearchProps {
  date: string;
  defaultMeal: Meal;
  onClose: () => void;
  onLogged: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const FoodSearch: Component<FoodSearchProps> = (props) => {
  /* ---- Search state ---- */
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchFood[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal("");

  /* ---- Selection state ---- */
  const [selected, setSelected] = createSignal<SearchFood | null>(null);
  const [servingSize, setServingSize] = createSignal("100");
  const [servingUnit, setServingUnit] = createSignal("g");
  const [meal, setMeal] = createSignal<Meal>(props.defaultMeal);
  const [logging, setLogging] = createSignal(false);
  const [logError, setLogError] = createSignal("");

  /* ---- AI estimation state (WRK-PP6-021) ---- */
  const [aiDescription, setAiDescription] = createSignal("");
  const [aiEstimating, setAiEstimating] = createSignal(false);
  const [aiResult, setAiResult] = createSignal<AIEstimationResponse | null>(null);
  const [aiError, setAiError] = createSignal("");

  /* ---- Text-only entry state (WRK-PP6-022) ---- */
  const [textDescription, setTextDescription] = createSignal("");
  const [textLogging, setTextLogging] = createSignal(false);
  const [textError, setTextError] = createSignal("");

  /* ---- Debounced search ---- */
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(
    on(query, (q) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (!q.trim()) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      debounceTimer = setTimeout(async () => {
        try {
          setSearchError("");
          const foods = await searchFoods(q);
          setResults(foods);
        } catch {
          setSearchError("Search failed. Try again.");
          setResults([]);
        } finally {
          setSearching(false);
        }
      }, 300);
    }),
  );

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  /* ---- Computed macros ---- */
  const computedMacros = () => {
    const food = selected();
    if (!food) return null;
    const size = parseFloat(servingSize());
    if (isNaN(size) || size <= 0) return null;
    return scaleMacros(food, size);
  };

  /* ---- Log food ---- */
  const handleLog = async () => {
    const food = selected();
    if (!food) return;
    const size = parseFloat(servingSize());
    if (isNaN(size) || size <= 0) return;

    setLogging(true);
    setLogError("");
    try {
      const macros = scaleMacros(food, size);
      await createFoodEntry({
        date: props.date,
        meal: meal(),
        foodName: food.name,
        fdcId: food.fdcId,
        servingSize: size,
        servingUnit: servingUnit(),
        calories: macros.calories ?? undefined,
        protein: macros.protein ?? undefined,
        carbs: macros.carbs ?? undefined,
        fat: macros.fat ?? undefined,
        fiber: macros.fiber ?? undefined,
        source: food.source,
      });
      props.onLogged();
      props.onClose();
    } catch {
      setLogError("Failed to log food. Try again.");
    } finally {
      setLogging(false);
    }
  };

  /* ---- AI estimation (WRK-PP6-021) ---- */
  const handleAiEstimate = async () => {
    const desc = aiDescription().trim();
    if (!desc) return;

    setAiEstimating(true);
    setAiError("");
    setAiResult(null);
    try {
      const result = await estimateFood(desc);
      setAiResult(result);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 503) {
          setAiError("AI estimation is not configured on this server.");
        } else if (err.status === 502) {
          setAiError("AI estimation is temporarily unavailable. Try again later.");
        } else {
          setAiError("Estimation failed. Try again.");
        }
      } else {
        setAiError("Estimation failed. Check your connection.");
      }
    } finally {
      setAiEstimating(false);
    }
  };

  /* ---- Log AI-estimated food ---- */
  const handleLogAiResult = async () => {
    const est = aiResult();
    if (!est) return;

    setLogging(true);
    setLogError("");
    try {
      await createFoodEntry({
        date: props.date,
        meal: meal(),
        foodName: aiDescription().trim(),
        calories: est.calories,
        protein: est.protein,
        carbs: est.carbs,
        fat: est.fat,
        fiber: est.fiber,
        source: "ai",
      });
      props.onLogged();
      props.onClose();
    } catch {
      setLogError("Failed to log food. Try again.");
    } finally {
      setLogging(false);
    }
  };

  /* ---- Text-only entry (WRK-PP6-022) ---- */
  const handleTextEntry = async () => {
    const desc = textDescription().trim();
    if (!desc) return;

    setTextLogging(true);
    setTextError("");
    try {
      await createTextFoodEntry({
        date: props.date,
        meal: meal(),
        description: desc,
      });
      props.onLogged();
      props.onClose();
    } catch {
      setTextError("Failed to log text entry. Try again.");
    } finally {
      setTextLogging(false);
    }
  };

  /* ---- No results state ---- */
  const showNoResults = () =>
    !searching() && query().trim() && results().length === 0 && !searchError();

  /* ---- Back to search ---- */
  const backToSearch = () => {
    setSelected(null);
    setServingSize("100");
    setServingUnit("g");
    setLogError("");
    setAiResult(null);
    setAiError("");
    setAiDescription("");
    setTextDescription("");
    setTextError("");
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div class="fixed inset-0 z-60 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        class="absolute inset-0 bg-black/50"
        onClick={props.onClose}
      />

      {/* Panel */}
      <div class="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-gray-800 rounded-t-2xl md:rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Show
            when={!selected()}
            fallback={
              <button
                class="touch-target text-sm font-medium text-blue-600 dark:text-blue-400"
                onClick={backToSearch}
              >
                Back
              </button>
            }
          >
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              Add Food
            </h2>
          </Show>
          <button
            class="touch-target p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={props.onClose}
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <Show
          when={!selected()}
          fallback={
            /* ============================================================ */
            /* QUANTITY / LOG FORM                                          */
            /* ============================================================ */
            <div class="flex-1 overflow-y-auto p-4 space-y-4">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {selected()!.name}
              </h3>

              {/* Serving size */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Serving Size
                </label>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    inputmode="decimal"
                    value={servingSize()}
                    onInput={(e) => setServingSize(e.currentTarget.value)}
                    class="touch-target flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    min="0"
                    step="any"
                  />
                  <input
                    type="text"
                    value={servingUnit()}
                    onInput={(e) => setServingUnit(e.currentTarget.value)}
                    class="touch-target w-16 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                  />
                </div>
              </div>

              {/* Live macro calculation */}
              <Show when={computedMacros()}>
                {(macros) => (
                  <div class="grid grid-cols-4 gap-2">
                    <div class="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                      <div class="text-lg font-bold text-orange-500">{macros().calories ?? "--"}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Cal</div>
                    </div>
                    <div class="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <div class="text-lg font-bold text-blue-500">{macros().protein ?? "--"}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Protein</div>
                    </div>
                    <div class="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                      <div class="text-lg font-bold text-yellow-500">{macros().carbs ?? "--"}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Carbs</div>
                    </div>
                    <div class="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                      <div class="text-lg font-bold text-red-500">{macros().fat ?? "--"}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Fat</div>
                    </div>
                  </div>
                )}
              </Show>

              {/* Meal selector */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Meal
                </label>
                <div class="flex flex-wrap gap-2">
                  <For each={[...MEALS]}>
                    {(m) => (
                      <button
                        class={`touch-target px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          meal() === m
                            ? "bg-blue-600 text-white dark:bg-blue-500"
                            : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                        onClick={() => setMeal(m)}
                      >
                        {MEAL_LABELS[m]}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Error */}
              <Show when={logError()}>
                <p class="text-sm text-red-600 dark:text-red-400">{logError()}</p>
              </Show>

              {/* Log button */}
              <button
                class="touch-target w-full py-3 rounded-lg text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                onClick={handleLog}
                disabled={logging() || !computedMacros()}
              >
                {logging() ? "Logging..." : "Log Food"}
              </button>
            </div>
          }
        >
          {/* ============================================================ */}
          {/* SEARCH VIEW                                                  */}
          {/* ============================================================ */}
          <div class="flex-1 overflow-y-auto">
            {/* Search input */}
            <div class="p-4 pb-2">
              <input
                type="text"
                placeholder="Search foods..."
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                autofocus
                class="touch-target w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Searching indicator */}
            <Show when={searching()}>
              <div class="px-4 py-2">
                <div class="space-y-2">
                  <div class="animate-pulse h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div class="animate-pulse h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div class="animate-pulse h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                </div>
              </div>
            </Show>

            {/* Error */}
            <Show when={searchError()}>
              <p class="px-4 py-2 text-sm text-red-600 dark:text-red-400">{searchError()}</p>
            </Show>

            {/* No results — show AI estimation + text-only entry (WRK-PP6-021 / WRK-PP6-022) */}
            <Show when={showNoResults()}>
              <div class="px-4 py-4 space-y-4">
                <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
                  No results found for "{query()}"
                </p>

                {/* AI Estimation Section */}
                <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
                    Describe your food for AI estimation
                  </h4>
                  <input
                    type="text"
                    placeholder="e.g. large bowl of chicken fried rice"
                    value={aiDescription()}
                    onInput={(e) => setAiDescription(e.currentTarget.value)}
                    class="min-h-[44px] w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <button
                    class="min-h-[44px] w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 transition-colors disabled:opacity-50"
                    onClick={handleAiEstimate}
                    disabled={aiEstimating() || !aiDescription().trim()}
                  >
                    {aiEstimating() ? "Estimating (2-5s)..." : "Calculate with AI"}
                  </button>

                  {/* AI estimation error */}
                  <Show when={aiError()}>
                    <p class="text-sm text-red-600 dark:text-red-400">{aiError()}</p>
                  </Show>

                  {/* AI estimation result */}
                  <Show when={aiResult()}>
                    {(est) => (
                      <div class="space-y-3">
                        <div class="flex items-center gap-2">
                          <SourceBadge source="ai" />
                          <span class="text-xs text-gray-500 dark:text-gray-400">
                            {est().servingDescription}
                          </span>
                        </div>
                        <div class="grid grid-cols-5 gap-1 text-center">
                          <div class="p-1.5 rounded bg-orange-50 dark:bg-orange-900/20">
                            <div class="text-sm font-bold text-orange-500">{est().calories}</div>
                            <div class="text-[10px] text-gray-500 dark:text-gray-400">Cal</div>
                          </div>
                          <div class="p-1.5 rounded bg-blue-50 dark:bg-blue-900/20">
                            <div class="text-sm font-bold text-blue-500">{est().protein}g</div>
                            <div class="text-[10px] text-gray-500 dark:text-gray-400">Pro</div>
                          </div>
                          <div class="p-1.5 rounded bg-yellow-50 dark:bg-yellow-900/20">
                            <div class="text-sm font-bold text-yellow-500">{est().carbs}g</div>
                            <div class="text-[10px] text-gray-500 dark:text-gray-400">Carb</div>
                          </div>
                          <div class="p-1.5 rounded bg-red-50 dark:bg-red-900/20">
                            <div class="text-sm font-bold text-red-500">{est().fat}g</div>
                            <div class="text-[10px] text-gray-500 dark:text-gray-400">Fat</div>
                          </div>
                          <div class="p-1.5 rounded bg-green-50 dark:bg-green-900/20">
                            <div class="text-sm font-bold text-green-500">{est().fiber}g</div>
                            <div class="text-[10px] text-gray-500 dark:text-gray-400">Fiber</div>
                          </div>
                        </div>

                        {/* Meal selector for AI result */}
                        <div class="flex flex-wrap gap-2">
                          <For each={[...MEALS]}>
                            {(m) => (
                              <button
                                class={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  meal() === m
                                    ? "bg-blue-600 text-white dark:bg-blue-500"
                                    : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }`}
                                onClick={() => setMeal(m)}
                              >
                                {MEAL_LABELS[m]}
                              </button>
                            )}
                          </For>
                        </div>

                        <Show when={logError()}>
                          <p class="text-sm text-red-600 dark:text-red-400">{logError()}</p>
                        </Show>

                        <button
                          class="min-h-[44px] w-full py-3 rounded-lg text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                          onClick={handleLogAiResult}
                          disabled={logging()}
                        >
                          {logging() ? "Logging..." : "Log AI Estimate"}
                        </button>
                      </div>
                    )}
                  </Show>
                </div>

                {/* Manual / Text-only entry fallback */}
                <div class="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Or log text-only (calculate later)
                  </h4>
                  <input
                    type="text"
                    placeholder="e.g. pasta with veggies"
                    value={textDescription()}
                    onInput={(e) => setTextDescription(e.currentTarget.value)}
                    class="min-h-[44px] w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <div class="flex flex-wrap gap-2">
                    <For each={[...MEALS]}>
                      {(m) => (
                        <button
                          class={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            meal() === m
                              ? "bg-blue-600 text-white dark:bg-blue-500"
                              : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                          onClick={() => setMeal(m)}
                        >
                          {MEAL_LABELS[m]}
                        </button>
                      )}
                    </For>
                  </div>
                  <Show when={textError()}>
                    <p class="text-sm text-red-600 dark:text-red-400">{textError()}</p>
                  </Show>
                  <button
                    class="min-h-[44px] w-full py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    onClick={handleTextEntry}
                    disabled={textLogging() || !textDescription().trim()}
                  >
                    {textLogging() ? "Saving..." : "Log Text Only"}
                  </button>
                </div>
              </div>
            </Show>

            {/* Results list — with source badges (WRK-PP6-020) */}
            <Show when={!searching() && results().length > 0}>
              <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                <For each={results()}>
                  {(food) => (
                    <li>
                      <button
                        class="touch-target w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        onClick={() => {
                          setSelected(food);
                          setServingSize(food.calculated?.servingSize != null ? String(food.calculated.servingSize) : "100");
                          setServingUnit(food.calculated?.servingUnit ?? food.servingUnit ?? "g");
                        }}
                      >
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                            {food.name}
                          </span>
                          <SourceBadge source={food.source} />
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {food.calories != null ? `${food.calories} cal` : "-- cal"} per 100g
                          <Show when={food.protein != null}>
                            {" "}· {food.protein}g protein
                          </Show>
                        </div>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default FoodSearch;
