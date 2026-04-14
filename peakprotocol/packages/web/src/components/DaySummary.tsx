/**
 * Day Summary detail panel.
 *
 * Displays all logged data for a selected day: supplements, nutrition,
 * training, metrics, and journal entries.
 */
import { Show, For, type JSX } from "solid-js";
import type { DailySummary } from "../lib/dailySummary";
import SupplementChecklist from "./SupplementChecklist";
import SourceBadge from "./SourceBadge";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface DaySummaryProps {
  /** The summary data, or undefined if not loaded */
  data: DailySummary | undefined;
  /** Loading state */
  loading: boolean;
  /** Error message, if any */
  error: string | undefined;
  /** Selected date for display */
  date: string;
  /** Callback after supplement checklist mutation (refetch data) */
  onMutate?: () => void;
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader(props: { title: string; icon: JSX.Element }): JSX.Element {
  return (
    <div class="flex items-center gap-2 mb-3">
      <span class="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
        {props.icon}
      </span>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {props.title}
      </h3>
    </div>
  );
}

function EmptySection(props: { message: string }): JSX.Element {
  return (
    <p class="text-sm text-gray-400 dark:text-gray-500 italic">
      {props.message}
    </p>
  );
}

function SkeletonPanel(): JSX.Element {
  return (
    <div class="animate-pulse space-y-4">
      <div class="h-5 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
      <div class="space-y-3">
        <div class="h-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div class="h-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div class="h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div class="h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons (inline SVG)                                                 */
/* ------------------------------------------------------------------ */

function PillIcon(): JSX.Element {
  return (
    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function ForkIcon(): JSX.Element {
  return (
    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.637.392M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DumbbellIcon(): JSX.Element {
  return (
    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h1m8-9v1m0 16v1m8-9h1M5.6 5.6l.7.7m12.4 12.4l.7.7m0-13.8l-.7.7M6.3 18.7l-.7.7" />
    </svg>
  );
}

function ScaleIcon(): JSX.Element {
  return (
    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  );
}

function JournalIcon(): JSX.Element {
  return (
    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function DaySummary(props: DaySummaryProps): JSX.Element {
  const displayDate = () => {
    const d = new Date(props.date + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const hasAnyData = () => {
    const d = props.data;
    if (!d) return false;
    return (
      d.supplements.total > 0 ||
      (d.supplements.dots && d.supplements.dots.length > 0) ||
      d.nutrition.calories > 0 ||
      d.training.sessions.length > 0 ||
      d.metrics.weight !== undefined ||
      d.metrics.hydration !== undefined ||
      d.journal.entries.length > 0
    );
  };

  return (
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 space-y-5">
      {/* Date header */}
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        {displayDate()}
      </h2>

      {/* Loading */}
      <Show when={props.loading}>
        <SkeletonPanel />
      </Show>

      {/* Error */}
      <Show when={props.error && !props.loading}>
        <div class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <p class="text-sm text-red-600 dark:text-red-400">
            Failed to load data: {props.error}
          </p>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!props.loading && !props.error && !hasAnyData()}>
        <div class="text-center py-8">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400">No data logged for this day.</p>
        </div>
      </Show>

      {/* Data sections */}
      <Show when={!props.loading && !props.error && hasAnyData()}>
        {/* ---- Supplements (Phase 6: interactive checklist) ---- */}
        <Show when={props.data!.supplements.total > 0 || (props.data!.supplements.dots && props.data!.supplements.dots.length > 0)}>
          <section>
            <SectionHeader title="Supplements" icon={<PillIcon />} />
            <div class="bg-gray-50 dark:bg-gray-750 rounded-xl p-3 space-y-2">
              {/* Summary bar */}
              <div class="flex items-center gap-3 mb-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {props.data!.supplements.taken}/{props.data!.supplements.total} taken
                </span>
                <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(props.data!.supplements.taken / props.data!.supplements.total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Phase 6: Interactive checklist with dots data (WRK-PP6-017/018) */}
              <Show
                when={props.data!.supplements.dots && props.data!.supplements.dots.length > 0}
                fallback={
                  /* Fallback to legacy item list when no dots data */
                  <For each={props.data!.supplements.items}>
                    {(item) => (
                      <div class="flex items-center gap-2 py-1">
                        <span
                          class={`w-2 h-2 rounded-full flex-shrink-0 ${
                            item.status === "taken" ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        />
                        <span class="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">
                          {item.name}
                        </span>
                        <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                          {item.dose}
                        </span>
                        <Show when={item.time}>
                          <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                            {item.time}
                          </span>
                        </Show>
                      </div>
                    )}
                  </For>
                }
              >
                <SupplementChecklist
                  supplements={props.data!.supplements.dots}
                  date={props.date}
                  doseMap={
                    props.data!.supplements.items.reduce(
                      (acc, item) => {
                        // Match by name since dots use supplementId
                        const dot = props.data!.supplements.dots.find((d) => d.name === item.name);
                        if (dot) {
                          acc[dot.supplementId] = { dose: item.dose, time: item.time };
                        }
                        return acc;
                      },
                      {} as Record<string, { dose: string; time: string }>,
                    )
                  }
                  onMutate={props.onMutate}
                />
              </Show>
            </div>
          </section>
        </Show>

        {/* ---- Nutrition ---- */}
        <Show when={props.data!.nutrition.calories > 0}>
          <section>
            <SectionHeader title="Nutrition" icon={<ForkIcon />} />
            <div class="bg-gray-50 dark:bg-gray-750 rounded-xl p-3 space-y-3">
              {/* Macro grid */}
              <div class="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p class="text-lg font-bold text-gray-900 dark:text-white">
                    {props.data!.nutrition.calories}
                  </p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">kcal</p>
                </div>
                <div>
                  <p class="text-lg font-bold text-blue-500">
                    {props.data!.nutrition.protein}g
                  </p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">Protein</p>
                </div>
                <div>
                  <p class="text-lg font-bold text-yellow-500">
                    {props.data!.nutrition.carbs}g
                  </p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">Carbs</p>
                </div>
                <div>
                  <p class="text-lg font-bold text-orange-500">
                    {props.data!.nutrition.fat}g
                  </p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">Fat</p>
                </div>
              </div>

              {/* Meal breakdown */}
              <Show when={props.data!.nutrition.meals.length > 0}>
                <div class="border-t border-gray-200 dark:border-gray-600 pt-2 space-y-2">
                  <For each={props.data!.nutrition.meals}>
                    {(meal) => (
                      <div>
                        <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                          {meal.meal}
                        </p>
                        <For each={meal.items}>
                          {(food) => (
                            <div class="flex items-center justify-between py-0.5">
                              <span class="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 mr-2 flex items-center gap-1.5">
                                {food.name}
                                <SourceBadge source={food.source} />
                              </span>
                              <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                {food.calories} kcal
                              </span>
                            </div>
                          )}
                        </For>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </section>
        </Show>

        {/* ---- Training ---- */}
        <Show when={props.data!.training.sessions.length > 0}>
          <section>
            <SectionHeader title="Training" icon={<DumbbellIcon />} />
            <div class="bg-gray-50 dark:bg-gray-750 rounded-xl p-3 space-y-2">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Total: {props.data!.training.totalDuration} min
              </p>
              <For each={props.data!.training.sessions}>
                {(session) => (
                  <div class="flex items-center justify-between py-1">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {session.type}
                      </p>
                      <Show when={session.notes}>
                        <p class="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {session.notes}
                        </p>
                      </Show>
                    </div>
                    <span class="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                      {session.duration} min
                    </span>
                  </div>
                )}
              </For>
            </div>
          </section>
        </Show>

        {/* ---- Metrics ---- */}
        <Show when={props.data!.metrics.weight !== undefined || props.data!.metrics.hydration !== undefined}>
          <section>
            <SectionHeader title="Metrics" icon={<ScaleIcon />} />
            <div class="bg-gray-50 dark:bg-gray-750 rounded-xl p-3">
              <div class="flex gap-6">
                <Show when={props.data!.metrics.weight !== undefined}>
                  <div>
                    <p class="text-lg font-bold text-gray-900 dark:text-white">
                      {props.data!.metrics.weight} <span class="text-xs font-normal text-gray-400">lbs</span>
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500">Weight</p>
                  </div>
                </Show>
                <Show when={props.data!.metrics.hydration !== undefined}>
                  <div>
                    <p class="text-lg font-bold text-blue-500">
                      {props.data!.metrics.hydration} <span class="text-xs font-normal text-gray-400">oz</span>
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500">Hydration</p>
                  </div>
                </Show>
              </div>
            </div>
          </section>
        </Show>

        {/* ---- Journal ---- */}
        <Show when={props.data!.journal.entries.length > 0}>
          <section>
            <SectionHeader title="Journal" icon={<JournalIcon />} />
            <div class="bg-gray-50 dark:bg-gray-750 rounded-xl p-3 space-y-2">
              <For each={props.data!.journal.entries}>
                {(entry) => (
                  <div class="py-1">
                    <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                      {entry.content}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {new Date(entry.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}
              </For>
            </div>
          </section>
        </Show>
      </Show>
    </div>
  );
}
