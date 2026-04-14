/**
 * Supplement Detail view with dose history, next occurrences,
 * and quick actions (WRK-016).
 */
import {
  createSignal,
  createResource,
  Show,
  For,
  type Component,
} from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import {
  fetchSupplement,
  fetchDoseHistory,
  fetchNextOccurrences,
  changeDose,
  deleteSupplement,
  type Supplement,
  type DoseChange,
  type ScheduleOccurrence,
} from "../lib/supplements";
import SupplementForm from "./SupplementForm";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function scheduleLabel(s: Supplement): string {
  const time = s.timeOfDay ? `, ${s.timeOfDay.toLowerCase()}` : "";
  switch (s.scheduleType) {
    case "daily":
      return `Daily${time}`;
    case "every_n_days": {
      const n = (s.scheduleValue as Record<string, unknown>)?.n ?? "?";
      return `Every ${n} days${time}`;
    }
    case "weekly": {
      const day = (s.scheduleValue as Record<string, unknown>)?.day ?? "?";
      return `Weekly (${day})${time}`;
    }
    case "specific_days": {
      const days = (s.scheduleValue as Record<string, unknown>)?.days;
      const dayStr = Array.isArray(days) ? days.join("/") : "?";
      return `${dayStr}${time}`;
    }
    default:
      return s.scheduleType ?? "Unknown";
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const SupplementDetail: Component = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const supplementId = () => params.id;

  const [supplement, { refetch }] = createResource(supplementId, (id) =>
    fetchSupplement(id),
  );
  const [doseData] = createResource(supplementId, (id) =>
    fetchDoseHistory(id),
  );
  const [nextOccurrences] = createResource(supplementId, (id) =>
    fetchNextOccurrences(id),
  );

  const [editing, setEditing] = createSignal(false);
  const [showDoseDialog, setShowDoseDialog] = createSignal(false);
  const [newDose, setNewDose] = createSignal("");
  const [newUnit, setNewUnit] = createSignal("");
  const [doseNotes, setDoseNotes] = createSignal("");
  const [doseError, setDoseError] = createSignal("");
  const [doseSaving, setDoseSaving] = createSignal(false);
  const [deactivating, setDeactivating] = createSignal(false);

  const handleChangeDose = async (e: Event) => {
    e.preventDefault();
    if (!newDose().trim()) {
      setDoseError("Dose is required");
      return;
    }
    setDoseSaving(true);
    setDoseError("");
    try {
      await changeDose(
        supplementId(),
        newDose(),
        newUnit() || supplement()?.unit || "",
        doseNotes() || undefined,
      );
      setShowDoseDialog(false);
      setNewDose("");
      setNewUnit("");
      setDoseNotes("");
      refetch();
    } catch (err: unknown) {
      setDoseError(err instanceof Error ? err.message : "Failed to change dose");
    } finally {
      setDoseSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await deleteSupplement(supplementId());
      navigate("/supplements");
    } catch {
      setDeactivating(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]";

  return (
    <div class="pb-24 md:pb-8 md:ml-56">
      <div class="max-w-2xl mx-auto px-4 py-6">
        {/* Back button */}
        <button
          class="touch-target inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
          onClick={() => navigate("/supplements")}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Loading */}
        <Show when={supplement.loading}>
          <div class="space-y-4 animate-pulse">
            <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          </div>
        </Show>

        {/* Error */}
        <Show when={supplement.error}>
          <div class="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300">
            Failed to load supplement.
          </div>
        </Show>

        <Show when={supplement()}>
          {(s) => (
            <>
              {/* Edit mode */}
              <Show when={editing()}>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Edit Supplement
                </h1>
                <SupplementForm
                  mode="edit"
                  supplement={s()}
                  onSaved={() => {
                    setEditing(false);
                    refetch();
                  }}
                />
              </Show>

              {/* View mode */}
              <Show when={!editing()}>
                {/* Header */}
                <div class="flex items-start justify-between mb-6">
                  <div>
                    <div class="flex items-center gap-2">
                      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                        {s().name}
                      </h1>
                      <span
                        class={`inline-block w-2.5 h-2.5 rounded-full ${
                          s().active ? "bg-green-500" : "bg-gray-400"
                        }`}
                        title={s().active ? "Active" : "Inactive"}
                      />
                    </div>
                    <Show when={s().currentDose}>
                      <p class="text-lg text-gray-600 dark:text-gray-400 mt-1">
                        {s().currentDose}
                        {s().unit ?? ""}
                      </p>
                    </Show>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {scheduleLabel(s())}
                    </p>
                    <Show when={s().tags?.length}>
                      <div class="flex flex-wrap gap-1.5 mt-2">
                        <For each={s().tags}>
                          {(tag) => (
                            <span class="inline-block rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-0.5 text-xs font-medium">
                              {tag}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Actions */}
                <div class="flex flex-wrap gap-2 mb-8">
                  <button
                    class="btn-primary touch-target text-sm"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </button>
                  <button
                    class="btn-secondary touch-target text-sm"
                    onClick={() => {
                      setNewDose(s().currentDose ?? "");
                      setNewUnit(s().unit ?? "");
                      setShowDoseDialog(true);
                    }}
                  >
                    Change Dose
                  </button>
                  <Show when={s().active}>
                    <button
                      class="btn touch-target text-sm bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                      onClick={handleDeactivate}
                      disabled={deactivating()}
                    >
                      {deactivating() ? "Deactivating..." : "Deactivate"}
                    </button>
                  </Show>
                </div>

                {/* Change Dose Dialog */}
                <Show when={showDoseDialog()}>
                  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div class="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6">
                      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Change Dose
                      </h2>
                      <Show when={doseError()}>
                        <div class="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-2 text-sm text-red-700 dark:text-red-300 mb-3">
                          {doseError()}
                        </div>
                      </Show>
                      <form onSubmit={handleChangeDose} class="space-y-3">
                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              New Dose
                            </label>
                            <input
                              type="text"
                              class={inputClass}
                              value={newDose()}
                              onInput={(e) => setNewDose(e.currentTarget.value)}
                            />
                          </div>
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Unit
                            </label>
                            <input
                              type="text"
                              class={inputClass}
                              value={newUnit()}
                              onInput={(e) => setNewUnit(e.currentTarget.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notes (optional)
                          </label>
                          <input
                            type="text"
                            class={inputClass}
                            value={doseNotes()}
                            onInput={(e) => setDoseNotes(e.currentTarget.value)}
                            placeholder="Reason for change"
                          />
                        </div>
                        <div class="flex gap-2 pt-2">
                          <button
                            type="submit"
                            class="btn-primary touch-target flex-1"
                            disabled={doseSaving()}
                          >
                            {doseSaving() ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            class="btn-secondary touch-target flex-1"
                            onClick={() => setShowDoseDialog(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </Show>

                {/* Dose History */}
                <section class="mb-8">
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Dose History
                  </h2>
                  <Show when={doseData.loading}>
                    <div class="animate-pulse space-y-2">
                      <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
                      <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
                    </div>
                  </Show>
                  <Show when={!doseData.loading && doseData()}>
                    <Show
                      when={doseData()!.history.length > 0}
                      fallback={
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          No dose changes recorded.
                        </p>
                      }
                    >
                      <ul class="space-y-2">
                        <For each={doseData()!.history}>
                          {(entry: DoseChange) => (
                            <li class="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                              <div class="flex-1">
                                <p class="text-sm font-medium text-gray-900 dark:text-white">
                                  {entry.dose}
                                  {entry.unit}
                                </p>
                                <Show when={entry.notes}>
                                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {entry.notes}
                                  </p>
                                </Show>
                              </div>
                              <time class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                {new Date(entry.changedAt).toLocaleDateString()}
                              </time>
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>
                  </Show>
                </section>

                {/* Next Occurrences */}
                <section>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Next Occurrences
                  </h2>
                  <Show when={nextOccurrences.loading}>
                    <div class="animate-pulse space-y-2">
                      <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-36" />
                      <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-36" />
                    </div>
                  </Show>
                  <Show when={!nextOccurrences.loading && nextOccurrences()}>
                    <Show
                      when={nextOccurrences()!.length > 0}
                      fallback={
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          No upcoming occurrences.
                        </p>
                      }
                    >
                      <ul class="space-y-1.5">
                        <For each={nextOccurrences()!.slice(0, 5)}>
                          {(occ: ScheduleOccurrence) => (
                            <li class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                              {new Date(occ.date).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                              <Show when={occ.timeOfDay}>
                                <span class="text-gray-400 dark:text-gray-500">
                                  - {occ.timeOfDay}
                                </span>
                              </Show>
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>
                  </Show>
                </section>
              </Show>
            </>
          )}
        </Show>
      </div>
    </div>
  );
};

export default SupplementDetail;
