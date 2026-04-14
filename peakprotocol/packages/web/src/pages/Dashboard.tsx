/**
 * Dashboard — the primary screen of PeakProtocol.
 *
 * Features a Calendar Day Summary view as the main content,
 * with today's compliance summary, schedule, quick-log actions,
 * weekly overview, and streak stats.
 */
import {
  createSignal,
  createResource,
  Show,
  For,
  createMemo,
  type JSX,
} from "solid-js";
import {
  getDailyCompliance,
  getRangeCompliance,
  getStreak,
  logSupplement,
  type ComplianceSummary,
  type ComplianceItem,
  type StreakInfo,
  type RangeComplianceResponse,
} from "../lib/compliance";
import { getDailySummary, type DailySummary } from "../lib/dailySummary";
import { fetchCalendarSupplements, type CalendarSupplementsResponse } from "../lib/supplements";
import Calendar from "../components/Calendar";
import DaySummaryPanel from "../components/DaySummary";
import QuickAdd from "../components/QuickAdd";
import Toast from "../components/Toast";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Monday-based week: returns [startDate, endDate] as ISO strings. */
function currentWeekRange(): [string, string] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}

function shortDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function rateColor(rate: number): string {
  if (rate > 80) return "#22c55e";
  if (rate >= 50) return "#eab308";
  return "#ef4444";
}

function rateColorClass(rate: number): string {
  if (rate > 80) return "text-green-500";
  if (rate >= 50) return "text-yellow-500";
  return "text-red-500";
}

function rateBgClass(rate: number): string {
  if (rate > 80) return "bg-green-500";
  if (rate >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

const TIME_ORDER: Record<string, number> = {
  morning: 0,
  "with_food": 1,
  evening: 2,
  anytime: 3,
};

function groupByTime(
  items: ComplianceItem[],
): { label: string; items: ComplianceItem[] }[] {
  const map = new Map<string, ComplianceItem[]>();
  for (const item of items) {
    const key = (item.timeOfDay || "anytime").toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()]
    .sort((a, b) => (TIME_ORDER[a[0]] ?? 99) - (TIME_ORDER[b[0]] ?? 99))
    .map(([label, items]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      items,
    }));
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ComplianceRing(props: { rate: number; size?: number }): JSX.Element {
  const size = () => props.size ?? 120;
  const stroke = 10;
  const radius = () => (size() - stroke) / 2;
  const circumference = () => 2 * Math.PI * radius();
  const offset = () => circumference() - (props.rate / 100) * circumference();
  const color = () => rateColor(props.rate);

  return (
    <svg
      width={size()}
      height={size()}
      class="transform -rotate-90"
      viewBox={`0 0 ${size()} ${size()}`}
    >
      <circle
        cx={size() / 2}
        cy={size() / 2}
        r={radius()}
        fill="none"
        stroke="currentColor"
        class="text-gray-200 dark:text-gray-700"
        stroke-width={stroke}
      />
      <circle
        cx={size() / 2}
        cy={size() / 2}
        r={radius()}
        fill="none"
        stroke={color()}
        stroke-width={stroke}
        stroke-linecap="round"
        stroke-dasharray={circumference()}
        stroke-dashoffset={offset()}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

function StatusIcon(props: { status: ComplianceItem["status"] }): JSX.Element {
  switch (props.status) {
    case "taken":
      return (
        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    case "missed":
      return (
        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      );
    case "skipped":
      return (
        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" />
          </svg>
        </span>
      );
    case "pending":
    default:
      return (
        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-500 dark:text-orange-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path stroke-linecap="round" d="M12 7v5l3 3" />
          </svg>
        </span>
      );
  }
}

function SkeletonCard(): JSX.Element {
  return (
    <div class="animate-pulse space-y-4 p-4">
      <div class="flex items-center gap-4">
        <div class="w-28 h-28 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div class="flex-1 space-y-2">
          <div class="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
      <div class="space-y-3">
        <div class="h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div class="h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div class="h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Dashboard                                                     */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const todayStr = today();
  const [weekRange] = createSignal(currentWeekRange());
  const [view, setView] = createSignal<"today" | "week" | "calendar">("calendar");
  const [loggingId, setLoggingId] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  // -- Calendar state --
  const [selectedDate, setSelectedDate] = createSignal(todayStr);
  const [calendarMonth, setCalendarMonth] = createSignal(todayStr.slice(0, 7));

  // -- Data fetching: daily compliance (for today view) --
  const [dailyData, { refetch: refetchDaily }] = createResource(
    () => todayStr,
    (date) => getDailyCompliance(date),
  );

  const [streakData, { refetch: refetchStreak }] = createResource(() =>
    getStreak(),
  );

  const [weekData, { refetch: refetchWeek }] = createResource(
    () => (view() === "week" ? weekRange() : null),
    (range) => {
      if (!range) return undefined;
      return getRangeCompliance(range[0], range[1]);
    },
  );

  // -- Data fetching: daily summary (for calendar day detail) --
  const [summaryData, { refetch: refetchSummary }] = createResource(
    () => (view() === "calendar" ? selectedDate() : null),
    (date) => {
      if (!date) return undefined;
      return getDailySummary(date);
    },
  );

  // -- Data fetching: calendar supplement dots & compliance (Phase 6) --
  const [calSupplData, { refetch: refetchCalSuppl }] = createResource(
    () => (view() === "calendar" ? calendarMonth() : null),
    (month) => {
      if (!month) return undefined;
      return fetchCalendarSupplements(month);
    },
  );

  const summaryError = () => {
    const err = summaryData.error;
    if (!err) return undefined;
    return err instanceof Error ? err.message : "Failed to load day summary";
  };

  // Build a set of active dates for the calendar dots
  // (We use the week range data when available; for now just mark today if there is compliance data)
  const activeDates = createMemo(() => {
    const set = new Set<string>();
    // Mark today if there's any compliance data
    const c = dailyData()?.compliance;
    if (c && c.totalScheduled > 0) {
      set.add(todayStr);
    }
    // Mark days from week data
    const wd = weekData();
    if (wd) {
      for (const day of wd.compliance) {
        if (day.taken > 0 || day.missed > 0 || day.skipped > 0) {
          set.add(day.date);
        }
      }
    }
    // Mark selected date if summary has data
    const sd = summaryData();
    if (sd) {
      const hasData =
        sd.supplements.total > 0 ||
        sd.nutrition.calories > 0 ||
        sd.training.sessions.length > 0 ||
        sd.metrics.weight !== undefined ||
        sd.metrics.hydration !== undefined ||
        sd.journal.entries.length > 0;
      if (hasData) set.add(sd.date);
    }
    return set;
  });

  // -- Derived (for today/compliance views) --
  const compliance = (): ComplianceSummary | undefined =>
    dailyData()?.compliance;
  const streak = (): StreakInfo | undefined => streakData()?.streak;
  const grouped = createMemo(() => {
    const items = compliance()?.items ?? [];
    return groupByTime(items);
  });

  // Optimistic items override
  const [optimistic, setOptimistic] = createSignal<
    Map<string, ComplianceItem["status"]>
  >(new Map());

  function effectiveStatus(item: ComplianceItem): ComplianceItem["status"] {
    return optimistic().get(item.supplementId) ?? item.status;
  }

  // -- Quick-log handler --
  async function handleLog(
    item: ComplianceItem,
    action: "take" | "skip",
  ): Promise<void> {
    const id = item.supplementId;
    setLoggingId(id + action);
    setError(null);

    // Optimistic update
    const prev = new Map(optimistic());
    prev.set(id, action === "take" ? "taken" : "skipped");
    setOptimistic(prev);

    try {
      await logSupplement(id, {
        scheduledDate: todayStr,
        ...(action === "take" ? { takenAt: new Date().toISOString() } : { skipped: true }),
      });
      // Clear optimistic — real data incoming
      const next = new Map(optimistic());
      next.delete(id);
      setOptimistic(next);
      // Refresh
      refetchDaily();
      refetchStreak();
      if (view() === "week") refetchWeek();
    } catch (err: unknown) {
      // Revert optimistic
      const revert = new Map(optimistic());
      revert.delete(id);
      setOptimistic(revert);
      const msg = err instanceof Error ? err.message : "Failed to log supplement";
      setError(msg);
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoggingId(null);
    }
  }

  // -- Week day circles data --
  const weekDays = createMemo((): { date: string; rate: number }[] => {
    const wd = weekData();
    if (!wd) return [];
    const [start] = weekRange();
    const result: { date: string; rate: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start + "T00:00:00");
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const summary = wd.compliance.find((c) => c.date === iso);
      result.push({ date: iso, rate: summary?.completionRate ?? 0 });
    }
    return result;
  });

  const isLoading = () => dailyData.loading || streakData.loading;

  return (
    <main class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 md:pb-8 md:ml-56">
      <div class="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Error toast */}
        <Show when={error()}>
          <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
            {error()}
          </div>
        </Show>

        {/* Loading skeleton */}
        <Show when={isLoading()}>
          <SkeletonCard />
        </Show>

        <Show when={!isLoading()}>
          {/* ---- View Toggle (3 tabs) ---- */}
          <div class="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
            <button
              type="button"
              class={`flex-1 py-2 text-sm font-medium rounded-md transition-colors min-h-11 ${
                view() === "calendar"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
              onClick={() => setView("calendar")}
            >
              Calendar
            </button>
            <button
              type="button"
              class={`flex-1 py-2 text-sm font-medium rounded-md transition-colors min-h-11 ${
                view() === "today"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
              onClick={() => setView("today")}
            >
              Today
            </button>
            <button
              type="button"
              class={`flex-1 py-2 text-sm font-medium rounded-md transition-colors min-h-11 ${
                view() === "week"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
              onClick={() => setView("week")}
            >
              Week
            </button>
          </div>

          {/* ---- Calendar View ---- */}
          <Show when={view() === "calendar"}>
            <Calendar
              selectedDate={selectedDate()}
              onSelect={(d) => setSelectedDate(d)}
              activeDates={activeDates()}
              supplementDays={calSupplData()?.days}
              complianceData={calSupplData()?.compliance}
              onMonthChange={(m) => setCalendarMonth(m)}
            />
            <DaySummaryPanel
              data={summaryData()}
              loading={summaryData.loading}
              error={summaryError()}
              date={selectedDate()}
              onMutate={() => {
                refetchSummary();
                refetchCalSuppl();
              }}
            />
          </Show>

          {/* ---- Today View (existing compliance) ---- */}
          <Show when={view() === "today"}>
            {/* Header Section */}
            <section class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {formatDisplayDate(todayStr)}
              </p>

              <div class="flex items-center gap-5">
                {/* Compliance ring */}
                <div class="relative flex-shrink-0">
                  <ComplianceRing rate={compliance()?.completionRate ?? 0} />
                  <div class="absolute inset-0 flex items-center justify-center">
                    <span
                      class={`text-2xl font-bold ${rateColorClass(compliance()?.completionRate ?? 0)}`}
                    >
                      {Math.round(compliance()?.completionRate ?? 0)}%
                    </span>
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <h1 class="text-xl font-bold text-gray-900 dark:text-white truncate">
                    Today's Compliance
                  </h1>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {compliance()?.taken ?? 0} of {compliance()?.totalScheduled ?? 0} taken
                  </p>

                  {/* Streak */}
                  <div class="mt-2">
                    <Show
                      when={(streak()?.current ?? 0) > 0}
                      fallback={
                        <span class="text-sm text-gray-400 dark:text-gray-500">
                          Start your streak!
                        </span>
                      }
                    >
                      <span class="text-sm font-semibold text-orange-500">
                        {"\uD83D\uDD25"} {streak()!.current} day streak
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
            </section>

            {/* Today's Schedule */}
            <section class="space-y-4">
              <For
                each={grouped()}
                fallback={
                  <div class="text-center py-8 text-gray-400 dark:text-gray-500">
                    No supplements scheduled for today.
                  </div>
                }
              >
                {(group) => (
                  <div>
                    <h2 class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1">
                      {group.label}
                    </h2>
                    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
                      <For each={group.items}>
                        {(item) => {
                          const status = () => effectiveStatus(item);
                          const isPending = () => status() === "pending";
                          const isTakeLoading = () =>
                            loggingId() === item.supplementId + "take";
                          const isSkipLoading = () =>
                            loggingId() === item.supplementId + "skip";

                          return (
                            <div class="flex items-center gap-3 px-4 py-3">
                              <StatusIcon status={status()} />
                              <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {item.supplementName}
                                </p>
                                <Show when={status() === "taken" && item.takenAt}>
                                  <p class="text-xs text-gray-400 dark:text-gray-500">
                                    Taken at {formatTime(item.takenAt)}
                                  </p>
                                </Show>
                              </div>

                              {/* Quick-log buttons for pending items */}
                              <Show when={isPending()}>
                                <div class="flex gap-2 flex-shrink-0">
                                  <button
                                    type="button"
                                    class="min-h-11 min-w-11 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center"
                                    disabled={!!loggingId()}
                                    onClick={() => handleLog(item, "take")}
                                  >
                                    <Show
                                      when={!isTakeLoading()}
                                      fallback={
                                        <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      }
                                    >
                                      Take
                                    </Show>
                                  </button>
                                  <button
                                    type="button"
                                    class="min-h-11 min-w-11 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center"
                                    disabled={!!loggingId()}
                                    onClick={() => handleLog(item, "skip")}
                                  >
                                    <Show
                                      when={!isSkipLoading()}
                                      fallback={
                                        <span class="inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                                      }
                                    >
                                      Skip
                                    </Show>
                                  </button>
                                </div>
                              </Show>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </section>
          </Show>

          {/* ---- Weekly Overview ---- */}
          <Show when={view() === "week"}>
            <section class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm space-y-5">
              <Show
                when={!weekData.loading}
                fallback={
                  <div class="flex justify-center py-6">
                    <span class="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                {/* Day circles */}
                <div class="flex justify-between">
                  <For each={weekDays()}>
                    {(day) => (
                      <div class="flex flex-col items-center gap-1.5">
                        <span class="text-xs text-gray-400 dark:text-gray-500">
                          {shortDay(day.date)}
                        </span>
                        <div
                          class={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            day.date > todayStr
                              ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                              : rateBgClass(day.rate)
                          }`}
                        >
                          {day.date <= todayStr ? Math.round(day.rate) : ""}
                        </div>
                      </div>
                    )}
                  </For>
                </div>

                {/* Overall stats */}
                <Show when={weekData()?.overall}>
                  {(overall) => (
                    <div class="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p class="text-2xl font-bold text-gray-900 dark:text-white">
                          {overall().totalTaken}
                        </p>
                        <p class="text-xs text-gray-400 dark:text-gray-500">
                          Taken
                        </p>
                      </div>
                      <div>
                        <p class="text-2xl font-bold text-gray-900 dark:text-white">
                          {overall().totalScheduled}
                        </p>
                        <p class="text-xs text-gray-400 dark:text-gray-500">
                          Scheduled
                        </p>
                      </div>
                      <div>
                        <p
                          class={`text-2xl font-bold ${rateColorClass(overall().completionRate)}`}
                        >
                          {Math.round(overall().completionRate)}%
                        </p>
                        <p class="text-xs text-gray-400 dark:text-gray-500">
                          Rate
                        </p>
                      </div>
                    </div>
                  )}
                </Show>
              </Show>
            </section>
          </Show>

          {/* ---- Stats Bar ---- */}
          <section class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
            <div class="grid grid-cols-3 gap-3 text-center">
              <div>
                <p class="text-xl font-bold text-orange-500">
                  {streak()?.current ?? 0}
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  Current Streak
                </p>
              </div>
              <div>
                <p class="text-xl font-bold text-blue-500">
                  {streak()?.longest ?? 0}
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  Longest Streak
                </p>
              </div>
              <div>
                <p
                  class={`text-xl font-bold ${rateColorClass(compliance()?.completionRate ?? 0)}`}
                >
                  {Math.round(compliance()?.completionRate ?? 0)}%
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  Today's Rate
                </p>
              </div>
            </div>
          </section>

          {/* ---- Quick Add Foods ---- */}
          <QuickAdd limit={8} date={todayStr} />
        </Show>

        {/* Toast notifications */}
        <Toast />
      </div>
    </main>
  );
}
