/**
 * Supplements list page (WRK-016).
 *
 * Shows all supplements with filter bar, cards, and empty state.
 */
import {
  createSignal,
  createResource,
  createMemo,
  Show,
  For,
  type Component,
} from "solid-js";
import { A } from "@solidjs/router";
import { fetchSupplements, type Supplement } from "../lib/supplements";

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

const Supplements: Component = () => {
  const [showActive, setShowActive] = createSignal(true);
  const [activeTag, setActiveTag] = createSignal<string | null>(null);

  const fetchParams = () => ({
    active: showActive() ? true : undefined,
    tag: activeTag() ?? undefined,
  });

  const [supplements, { refetch }] = createResource(fetchParams, (p) =>
    fetchSupplements(p),
  );

  // Collect unique tags across all supplements for filter chips
  const allTags = createMemo(() => {
    const items = supplements();
    if (!items) return [];
    const tagSet = new Set<string>();
    items.forEach((s) => s.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  });

  return (
    <div class="pb-24 md:pb-8 md:ml-56">
      <div class="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Supplements
          </h1>
          <A href="/supplements/new" class="btn-primary touch-target text-sm">
            + Add Supplement
          </A>
        </div>

        {/* Filter bar */}
        <div class="flex flex-wrap items-center gap-2 mb-5">
          {/* Active / Inactive toggle */}
          <button
            class={`touch-target rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              showActive()
                ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
                : "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
            }`}
            onClick={() => {
              setShowActive(!showActive());
              refetch();
            }}
          >
            {showActive() ? "Active" : "All"}
          </button>

          {/* Tag chips */}
          <For each={allTags()}>
            {(tag) => (
              <button
                class={`touch-target rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  activeTag() === tag
                    ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                    : "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                }`}
                onClick={() => {
                  setActiveTag(activeTag() === tag ? null : tag);
                  refetch();
                }}
              >
                {tag}
              </button>
            )}
          </For>
        </div>

        {/* Loading skeleton */}
        <Show when={supplements.loading}>
          <div class="space-y-3">
            <For each={[1, 2, 3]}>
              {() => (
                <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-2" />
                  <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1" />
                  <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-56" />
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Error */}
        <Show when={supplements.error}>
          <div class="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300">
            Failed to load supplements. Please try again.
          </div>
        </Show>

        {/* Supplement list */}
        <Show when={!supplements.loading && supplements()}>
          {/* Empty state */}
          <Show when={supplements()!.length === 0}>
            <div class="text-center py-16">
              <svg
                class="mx-auto w-16 h-16 text-gray-300 dark:text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <h2 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No supplements yet
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Start tracking your supplements to stay on top of your protocol.
              </p>
              <A
                href="/supplements/new"
                class="btn-primary touch-target text-sm"
              >
                + Add Your First Supplement
              </A>
            </div>
          </Show>

          {/* Cards */}
          <Show when={supplements()!.length > 0}>
            <div class="space-y-3">
              <For each={supplements()}>
                {(s: Supplement) => (
                  <A
                    href={`/supplements/${s.id}`}
                    class="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors touch-target"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate">
                            {s.name}
                          </h3>
                          <span
                            class={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                              s.active ? "bg-green-500" : "bg-gray-400"
                            }`}
                            title={s.active ? "Active" : "Inactive"}
                          />
                        </div>
                        <Show when={s.currentDose}>
                          <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            {s.currentDose}
                            {s.unit ?? ""}
                          </p>
                        </Show>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {scheduleLabel(s)}
                        </p>
                        <Show when={s.tags?.length}>
                          <div class="flex flex-wrap gap-1 mt-2">
                            <For each={s.tags}>
                              {(tag) => (
                                <span class="inline-block rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 text-xs">
                                  {tag}
                                </span>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                      <svg
                        class="w-5 h-5 text-gray-400 flex-shrink-0 mt-1"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </A>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default Supplements;
