/**
 * Food entry manual edit modal (WRK-PP6-024).
 *
 * Tap-to-edit modal for overriding macro values on any food entry.
 * Calls PUT /api/food-entries/:id, which sets source = "manual".
 */
import {
  createSignal,
  Show,
  type Component,
} from "solid-js";
import { updateFoodEntry, type FoodEntry } from "../lib/food";

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */

interface FoodEntryEditProps {
  entry: FoodEntry;
  onClose: () => void;
  onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const FoodEntryEdit: Component<FoodEntryEditProps> = (props) => {
  const [calories, setCalories] = createSignal(
    props.entry.calories != null ? String(props.entry.calories) : "",
  );
  const [protein, setProtein] = createSignal(
    props.entry.protein != null ? String(props.entry.protein) : "",
  );
  const [carbs, setCarbs] = createSignal(
    props.entry.carbs != null ? String(props.entry.carbs) : "",
  );
  const [fat, setFat] = createSignal(
    props.entry.fat != null ? String(props.entry.fat) : "",
  );
  const [fiber, setFiber] = createSignal(
    props.entry.fiber != null ? String(props.entry.fiber) : "",
  );
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");

  const handleSave = async () => {
    setSaving(true);
    setError("");

    const data: Record<string, number> = {};
    const calVal = parseFloat(calories());
    const proVal = parseFloat(protein());
    const carbVal = parseFloat(carbs());
    const fatVal = parseFloat(fat());
    const fibVal = parseFloat(fiber());

    if (!isNaN(calVal)) data.calories = calVal;
    if (!isNaN(proVal)) data.protein = proVal;
    if (!isNaN(carbVal)) data.carbs = carbVal;
    if (!isNaN(fatVal)) data.fat = fatVal;
    if (!isNaN(fibVal)) data.fiber = fibVal;

    if (Object.keys(data).length === 0) {
      setError("Enter at least one macro value.");
      setSaving(false);
      return;
    }

    try {
      await updateFoodEntry(props.entry.id, data);
      props.onSaved();
      props.onClose();
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="fixed inset-0 z-60 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        class="absolute inset-0 bg-black/50"
        onClick={props.onClose}
      />

      {/* Panel */}
      <div class="relative w-full max-w-md mx-4 mb-4 md:mb-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white truncate">
            Edit: {props.entry.foodName}
          </h2>
          <button
            class="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={props.onClose}
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div class="p-4 space-y-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Edit macros below. Saving sets source to "Manual".
          </p>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Calories
              </label>
              <input
                type="number"
                inputmode="decimal"
                value={calories()}
                onInput={(e) => setCalories(e.currentTarget.value)}
                placeholder="--"
                class="min-h-[44px] w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                min="0"
                step="any"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Protein (g)
              </label>
              <input
                type="number"
                inputmode="decimal"
                value={protein()}
                onInput={(e) => setProtein(e.currentTarget.value)}
                placeholder="--"
                class="min-h-[44px] w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                min="0"
                step="any"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Carbs (g)
              </label>
              <input
                type="number"
                inputmode="decimal"
                value={carbs()}
                onInput={(e) => setCarbs(e.currentTarget.value)}
                placeholder="--"
                class="min-h-[44px] w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                min="0"
                step="any"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Fat (g)
              </label>
              <input
                type="number"
                inputmode="decimal"
                value={fat()}
                onInput={(e) => setFat(e.currentTarget.value)}
                placeholder="--"
                class="min-h-[44px] w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                min="0"
                step="any"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Fiber (g)
              </label>
              <input
                type="number"
                inputmode="decimal"
                value={fiber()}
                onInput={(e) => setFiber(e.currentTarget.value)}
                placeholder="--"
                class="min-h-[44px] w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                min="0"
                step="any"
              />
            </div>
          </div>

          {/* Error */}
          <Show when={error()}>
            <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
          </Show>

          {/* Save button */}
          <button
            class="min-h-[44px] w-full py-3 rounded-lg text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
            onClick={handleSave}
            disabled={saving()}
          >
            {saving() ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FoodEntryEdit;
