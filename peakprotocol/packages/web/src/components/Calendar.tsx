/**
 * Monthly Calendar grid component.
 *
 * Renders a navigable monthly view with selectable days,
 * today highlighting, and activity indicators.
 * Mobile-first with 44px touch targets.
 */
import { createSignal, createMemo, For, Show, type JSX } from "solid-js";
import SupplementDots from "./SupplementDots";
import type { DaySupplementStatus } from "../lib/supplements";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface CalendarProps {
  /** Currently selected date (YYYY-MM-DD) */
  selectedDate: string;
  /** Callback when user clicks a day */
  onSelect: (date: string) => void;
  /** Set of dates (YYYY-MM-DD) that have activity data */
  activeDates?: Set<string>;
  /** Phase 6: per-day supplement dot data from calendar-supplements API */
  supplementDays?: Record<string, DaySupplementStatus[]>;
  /** Phase 6: per-day compliance tint data from calendar-supplements API (WRK-PP6-019) */
  complianceData?: Record<string, "full" | "partial" | "none" | null>;
  /** Callback when the viewed month changes (YYYY-MM) */
  onMonthChange?: (month: string) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  return toIso(new Date());
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Compliance heatmap background class (WRK-PP6-019). */
function complianceTintClass(level: "full" | "partial" | "none" | null | undefined): string {
  switch (level) {
    case "full":
      return "bg-green-50 dark:bg-green-900/15";
    case "partial":
      return "bg-amber-50 dark:bg-amber-900/15";
    case "none":
    case null:
    case undefined:
    default:
      return "";
  }
}

/** Build calendar grid: 6 rows x 7 cols of Date objects. */
function buildGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  // Monday-based: 0=Mon, 6=Sun
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows: (Date | null)[][] = [];
  let current = 1 - startDow;

  for (let r = 0; r < 6; r++) {
    const row: (Date | null)[] = [];
    for (let c = 0; c < 7; c++) {
      if (current >= 1 && current <= daysInMonth) {
        row.push(new Date(year, month, current));
      } else {
        row.push(null);
      }
      current++;
    }
    // Skip entirely empty trailing rows
    if (row.every((d) => d === null) && r > 0) break;
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function Calendar(props: CalendarProps): JSX.Element {
  // Parse initial month from selectedDate
  const initDate = new Date(props.selectedDate + "T00:00:00");
  const [viewYear, setViewYear] = createSignal(initDate.getFullYear());
  const [viewMonth, setViewMonth] = createSignal(initDate.getMonth());

  const grid = createMemo(() => buildGrid(viewYear(), viewMonth()));

  const monthLabel = createMemo(() => {
    const d = new Date(viewYear(), viewMonth(), 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  });

  /** Format a month string as YYYY-MM for API calls. */
  function currentMonthStr(): string {
    return `${viewYear()}-${String(viewMonth() + 1).padStart(2, "0")}`;
  }

  function prevMonth() {
    if (viewMonth() === 0) {
      setViewMonth(11);
      setViewYear(viewYear() - 1);
    } else {
      setViewMonth(viewMonth() - 1);
    }
    props.onMonthChange?.(currentMonthStr());
  }

  function nextMonth() {
    if (viewMonth() === 11) {
      setViewMonth(0);
      setViewYear(viewYear() + 1);
    } else {
      setViewMonth(viewMonth() + 1);
    }
    props.onMonthChange?.(currentMonthStr());
  }

  const todayStr = todayIso();

  return (
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
      {/* Navigation header */}
      <div class="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          class="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Previous month"
        >
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {monthLabel()}
        </h2>

        <button
          type="button"
          onClick={nextMonth}
          class="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Next month"
        >
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div class="grid grid-cols-7 mb-1">
        <For each={WEEKDAYS}>
          {(day) => (
            <div class="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
              {day}
            </div>
          )}
        </For>
      </div>

      {/* Day grid */}
      <div class="space-y-1" role="grid" aria-label="Calendar">
        <For each={grid()}>
          {(row) => (
            <div class="grid grid-cols-7" role="row">
              <For each={row}>
                {(cell) => {
                  if (!cell) {
                    return <div class="min-h-11" role="gridcell" />;
                  }

                  const iso = toIso(cell);
                  const isToday = iso === todayStr;
                  const isSelected = () => iso === props.selectedDate;
                  const hasData = () => props.activeDates?.has(iso) ?? false;
                  const isFuture = iso > todayStr;
                  const daySupplements = () => props.supplementDays?.[iso] ?? [];
                  const hasDots = () => daySupplements().length > 0;
                  const complianceLevel = () => props.complianceData?.[iso];
                  const tintClass = () => complianceTintClass(complianceLevel());

                  return (
                    <button
                      type="button"
                      role="gridcell"
                      aria-label={`${cell.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${isToday ? ", today" : ""}${hasData() ? ", has activity" : ""}${complianceLevel() === "full" ? ", full compliance" : complianceLevel() === "partial" ? ", partial compliance" : ""}`}
                      aria-selected={isSelected()}
                      class={`
                        min-h-11 min-w-0 w-full flex flex-col items-center justify-center rounded-lg
                        text-sm font-medium transition-colors relative
                        ${isSelected()
                          ? "bg-blue-100 text-blue-900 ring-2 ring-blue-500 font-bold"
                          : isToday
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                            : isFuture
                              ? "text-gray-300 dark:text-gray-600"
                              : `text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${tintClass()}`
                        }
                      `}
                      disabled={isFuture}
                      onClick={() => props.onSelect(iso)}
                    >
                      {cell.getDate()}
                      {/* Phase 6: Supplement dots (WRK-PP6-016) */}
                      <Show when={hasDots()}>
                        <SupplementDots
                          supplements={daySupplements()}
                          isSelected={isSelected()}
                        />
                      </Show>
                      {/* Legacy activity dot (only show when no supplement dots) */}
                      <Show when={!hasDots() && hasData() && !isSelected()}>
                        <span class="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-green-500" />
                      </Show>
                      <Show when={!hasDots() && hasData() && isSelected()}>
                        <span class="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-blue-600" />
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
          )}
        </For>
      </div>

      {/* Today shortcut */}
      <Show when={!(viewYear() === new Date().getFullYear() && viewMonth() === new Date().getMonth())}>
        <button
          type="button"
          class="mt-3 w-full min-h-11 text-sm font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          onClick={() => {
            const now = new Date();
            setViewYear(now.getFullYear());
            setViewMonth(now.getMonth());
            props.onSelect(todayStr);
          }}
        >
          Go to today
        </button>
      </Show>
    </div>
  );
}
