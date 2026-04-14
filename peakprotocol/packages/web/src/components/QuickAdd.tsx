/**
 * Quick-Add food component (WRK-027).
 *
 * Displays a grid of saved foods for fast one-tap logging.
 * 3-tap flow: see grid -> tap food -> tap meal -> done.
 */
import {
  createSignal,
  createResource,
  Show,
  For,
  type JSX,
} from "solid-js";
import { A } from "@solidjs/router";
import { getSavedFoods, logQuickAdd, type SavedFood } from "../lib/saved-foods";
import { MEALS, MEAL_LABELS } from "../lib/food";
import { showToast } from "./Toast";

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */

interface QuickAddProps {
  /** Max number of foods to show (default 8) */
  limit?: number;
  /** Current date in YYYY-MM-DD format */
  date?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function QuickAdd(props: QuickAddProps): JSX.Element {
  const limit = () => props.limit ?? 8;
  const date = () => props.date ?? today();

  /* ---- Data ---- */
  const [savedFoods] = createResource(
    () => limit(),
    (lim) => getSavedFoods(lim),
  );

  /* ---- Meal selector state ---- */
  const [selectedFood, setSelectedFood] = createSignal<SavedFood | null>(null);
  const [logging, setLogging] = createSignal(false);

  /* ---- Handlers ---- */
  const openMealSelector = (food: SavedFood) => {
    setSelectedFood(food);
  };

  const closeMealSelector = () => {
    setSelectedFood(null);
  };

  const handleMealSelect = async (meal: string) => {
    const food = selectedFood();
    if (!food || logging()) return;

    setLogging(true);
    try {
      await logQuickAdd(food, meal, date());
      showToast(`Logged: ${food.name} for ${meal}`);
      closeMealSelector();
    } catch {
      showToast("Failed to log food. Try again.");
    } finally {
      setLogging(false);
    }
  };

  /* ---- Render ---- */
  const hasFoods = () => (savedFoods() ?? []).length > 0;

  return (
    <>
      <Show when={!savedFoods.loading}>
        {/* Only render section if there are saved foods, OR show empty state */}
        <section class="space-y-3">
          {/* Header */}
          <div class="flex items-center justify-between px-1">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              Quick Add
            </h2>
            <A
              href="/food"
              class="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Manage
            </A>
          </div>

          <Show
            when={hasFoods()}
            fallback={
              /* Empty state */
              <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm text-center">
                <svg
                  class="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  No saved foods yet. Search and save foods from the{" "}
                  <A
                    href="/food"
                    class="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Food page
                  </A>
                  .
                </p>
              </div>
            }
          >
            {/* Food cards grid */}
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              <For each={savedFoods()}>
                {(food) => (
                  <button
                    type="button"
                    class="min-h-[44px] bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 text-left hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all active:scale-[0.97]"
                    onClick={() => openMealSelector(food)}
                  >
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {food.name}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {food.customServingSize ?? "--"}
                      {food.customServingUnit ?? "g"}
                    </p>
                    <p class="text-xs font-semibold text-orange-500 mt-1">
                      {food.calories != null ? `${food.calories} cal` : "-- cal"}
                    </p>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </section>
      </Show>

      {/* Meal selector overlay */}
      <Show when={selectedFood()}>
        <div class="fixed inset-0 z-60 flex items-end md:items-center justify-center">
          {/* Backdrop */}
          <div
            class="absolute inset-0 bg-black/50"
            onClick={closeMealSelector}
          />

          {/* Panel */}
          <div class="relative w-full max-w-sm mx-4 mb-4 md:mb-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div class="px-4 pt-4 pb-2">
              <p class="text-sm text-gray-500 dark:text-gray-400">Log to meal</p>
              <p class="text-base font-semibold text-gray-900 dark:text-white truncate mt-0.5">
                {selectedFood()!.name}
              </p>
            </div>

            {/* Meal buttons */}
            <div class="grid grid-cols-2 gap-2 p-4">
              <For each={[...MEALS]}>
                {(meal) => (
                  <button
                    type="button"
                    class="min-h-[44px] py-3 rounded-xl text-sm font-semibold transition-colors bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:bg-blue-200 dark:active:bg-blue-800/50 disabled:opacity-50"
                    onClick={() => handleMealSelect(meal)}
                    disabled={logging()}
                  >
                    <Show
                      when={!logging()}
                      fallback={
                        <span class="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      }
                    >
                      {MEAL_LABELS[meal]}
                    </Show>
                  </button>
                )}
              </For>
            </div>

            {/* Cancel */}
            <div class="px-4 pb-4">
              <button
                type="button"
                class="w-full min-h-[44px] py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                onClick={closeMealSelector}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
