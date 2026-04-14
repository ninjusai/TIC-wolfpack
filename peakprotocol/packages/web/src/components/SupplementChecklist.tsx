/**
 * SupplementChecklist — interactive checklist for day detail view (WRK-PP6-017, WRK-PP6-018).
 *
 * Displays supplement rows with checkboxes for a selected day.
 * Each row: checkbox, supplement name (with color indicator), dose, time-of-day label.
 *
 * - Checking: POST to supplement log API, optimistic UI
 * - Unchecking: DELETE log record, revert checkbox
 * - "Mark All Taken" batch button (WRK-PP6-018)
 *
 * Uses SolidJS reactivity (no prop destructuring).
 */
import {
  createSignal,
  createMemo,
  For,
  Show,
  type JSX,
} from "solid-js";
import type { SupplementDotStatus } from "../lib/dailySummary";
import {
  batchLogSupplements,
  deleteSupplementLog,
} from "../lib/supplements";
import { logSupplement } from "../lib/compliance";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface SupplementChecklistProps {
  /** Per-supplement status data for the selected day */
  supplements: SupplementDotStatus[];
  /** The selected date (YYYY-MM-DD) */
  date: string;
  /** Optional: supplement dose info from daily summary items */
  doseMap?: Record<string, { dose: string; time: string }>;
  /** Callback after a mutation completes (to refetch parent data) */
  onMutate?: () => void;
}

/* ------------------------------------------------------------------ */
/* Time-of-day label helper                                            */
/* ------------------------------------------------------------------ */

const TIME_LABELS: Record<string, string> = {
  morning: "Morning",
  evening: "Evening",
  with_food: "With food",
  anytime: "Anytime",
};

function formatTimeLabel(time: string | undefined): string {
  if (!time) return "";
  return TIME_LABELS[time.toLowerCase()] ?? time;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function SupplementChecklist(props: SupplementChecklistProps): JSX.Element {
  // Optimistic state: overrides per supplement ID
  const [optimistic, setOptimistic] = createSignal<Map<string, SupplementDotStatus["status"]>>(new Map());
  const [loadingIds, setLoadingIds] = createSignal<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  /** Get effective status (optimistic override or real). */
  function effectiveStatus(supp: SupplementDotStatus): SupplementDotStatus["status"] {
    return optimistic().get(supp.supplementId) ?? supp.status;
  }

  /** Count pending supplements (not yet taken). */
  const pendingSupplements = createMemo(() =>
    props.supplements.filter(
      (s) => effectiveStatus(s) === "pending" || effectiveStatus(s) === "skipped",
    ),
  );

  const hasPending = createMemo(() =>
    props.supplements.some((s) => effectiveStatus(s) !== "taken"),
  );

  const allTaken = createMemo(() =>
    props.supplements.length > 0 &&
    props.supplements.every((s) => effectiveStatus(s) === "taken"),
  );

  /* ---- Individual toggle ---- */

  async function handleToggle(supp: SupplementDotStatus): Promise<void> {
    const id = supp.supplementId;
    const currentStatus = effectiveStatus(supp);

    // Add to loading set
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setError(null);

    if (currentStatus === "taken") {
      // Uncheck: delete the taken log if we have the logId, otherwise fall
      // back to logging a skip.
      const prev = new Map(optimistic());
      prev.set(id, "pending");
      setOptimistic(prev);

      try {
        if (supp.logId) {
          await deleteSupplementLog(supp.logId);
        } else {
          // Fallback: log a skip to override the taken status when logId
          // is not available (older API responses).
          await logSupplement(id, {
            scheduledDate: props.date,
            skipped: true,
          });
        }
        // Clear optimistic for this item
        const next = new Map(optimistic());
        next.delete(id);
        setOptimistic(next);
        props.onMutate?.();
      } catch (err: unknown) {
        // Revert optimistic
        const revert = new Map(optimistic());
        revert.delete(id);
        setOptimistic(revert);
        setError(err instanceof Error ? err.message : "Failed to update");
        setTimeout(() => setError(null), 4000);
      }
    } else {
      // Check: mark as taken
      const prev = new Map(optimistic());
      prev.set(id, "taken");
      setOptimistic(prev);

      try {
        await logSupplement(id, {
          scheduledDate: props.date,
          takenAt: new Date().toISOString(),
        });
        const next = new Map(optimistic());
        next.delete(id);
        setOptimistic(next);
        props.onMutate?.();
      } catch (err: unknown) {
        const revert = new Map(optimistic());
        revert.delete(id);
        setOptimistic(revert);
        setError(err instanceof Error ? err.message : "Failed to log");
        setTimeout(() => setError(null), 4000);
      }
    }

    // Remove from loading set
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  /* ---- Batch mark all taken (WRK-PP6-018) ---- */

  async function handleMarkAllTaken(): Promise<void> {
    const pendingIds = props.supplements
      .filter((s) => effectiveStatus(s) !== "taken")
      .map((s) => s.supplementId);

    if (pendingIds.length === 0) return;

    setBatchLoading(true);
    setError(null);

    // Optimistic: mark all as taken
    const prev = new Map(optimistic());
    for (const id of pendingIds) {
      prev.set(id, "taken");
    }
    setOptimistic(prev);

    try {
      await batchLogSupplements(props.date, pendingIds);
      // Clear all optimistic overrides
      const next = new Map(optimistic());
      for (const id of pendingIds) {
        next.delete(id);
      }
      setOptimistic(next);
      props.onMutate?.();
    } catch (err: unknown) {
      // Revert all
      const revert = new Map(optimistic());
      for (const id of pendingIds) {
        revert.delete(id);
      }
      setOptimistic(revert);
      setError(err instanceof Error ? err.message : "Batch log failed");
      setTimeout(() => setError(null), 4000);
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <div class="space-y-2">
      {/* Error message */}
      <Show when={error()}>
        <div class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
          <p class="text-xs text-red-600 dark:text-red-400">{error()}</p>
        </div>
      </Show>

      {/* Supplement rows */}
      <div class="space-y-1">
        <For each={props.supplements}>
          {(supp) => {
            const status = () => effectiveStatus(supp);
            const isLoading = () => loadingIds().has(supp.supplementId);
            const isTaken = () => status() === "taken";
            const doseInfo = () => props.doseMap?.[supp.supplementId];

            return (
              <button
                type="button"
                class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors min-h-11
                  ${isTaken()
                    ? "bg-green-50 dark:bg-green-900/20"
                    : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                  }
                `}
                onClick={() => handleToggle(supp)}
                disabled={isLoading() || batchLoading()}
                aria-label={`${supp.name}: ${status()}`}
              >
                {/* Checkbox */}
                <div
                  class={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                    ${isTaken()
                      ? "bg-green-500 border-green-500"
                      : status() === "skipped"
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                        : "border-gray-300 dark:border-gray-600"
                    }
                  `}
                >
                  <Show when={isTaken()}>
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </Show>
                  <Show when={status() === "skipped"}>
                    <svg class="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" />
                    </svg>
                  </Show>
                  <Show when={isLoading()}>
                    <span class="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  </Show>
                </div>

                {/* Color indicator */}
                <span
                  class="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                  style={{ "background-color": supp.color }}
                />

                {/* Name + dose */}
                <div class="flex-1 min-w-0 text-left">
                  <span
                    class={`text-sm font-medium truncate block ${
                      isTaken()
                        ? "text-gray-500 dark:text-gray-400 line-through"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {supp.name}
                  </span>
                </div>

                {/* Dose */}
                <Show when={doseInfo()?.dose}>
                  <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {doseInfo()!.dose}
                  </span>
                </Show>

                {/* Time of day label */}
                <Show when={doseInfo()?.time}>
                  <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 hidden sm:inline">
                    {formatTimeLabel(doseInfo()!.time)}
                  </span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      {/* Mark All Taken button (WRK-PP6-018) */}
      <Show when={hasPending() && props.supplements.length > 1}>
        <button
          type="button"
          class={`w-full min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2
            ${allTaken()
              ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 cursor-default"
              : "bg-green-500 hover:bg-green-600 text-white"
            }
            disabled:opacity-50
          `}
          disabled={batchLoading() || allTaken()}
          onClick={handleMarkAllTaken}
          aria-label="Mark all supplements as taken"
        >
          <Show
            when={!batchLoading()}
            fallback={
              <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            }
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Mark All Taken
          </Show>
        </button>
      </Show>

      {/* All taken confirmation */}
      <Show when={allTaken()}>
        <p class="text-center text-xs text-green-600 dark:text-green-400 font-medium py-1">
          All supplements taken for this day
        </p>
      </Show>
    </div>
  );
}
