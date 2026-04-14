/**
 * Reports / Analysis page (WRK-038).
 *
 * Shows weight trend, macro averages, and correlation analysis.
 * Mobile-first card layout with period selector.
 */
import {
  createSignal,
  createResource,
  Show,
  For,
  type Component,
} from "solid-js";
import {
  getAnalysisReport,
  type AnalysisReport,
  type CorrelationResult,
} from "../lib/analysis";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const PERIOD_OPTIONS = [30, 60, 90] as const;

/** Human-readable metric name. */
function metricLabel(key: string): string {
  const map: Record<string, string> = {
    weight: "Weight",
    calories: "Calories",
    protein: "Protein",
    carbs: "Carbs",
    fat: "Fat",
    fiber: "Fiber",
    sleep_hours: "Sleep",
    steps: "Steps",
    training_volume: "Training Volume",
  };
  return map[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Correlation strength category. */
function corrStrength(val: number | null): "strong" | "moderate" | "weak" {
  if (val === null) return "weak";
  const abs = Math.abs(val);
  if (abs >= 0.5) return "strong";
  if (abs >= 0.25) return "moderate";
  return "weak";
}

/** Color class for correlation strength. */
function corrColor(val: number | null): string {
  const s = corrStrength(val);
  if (s === "strong") return "bg-green-500";
  if (s === "moderate") return "bg-yellow-500";
  return "bg-gray-400";
}

/** Border color class for correlation card. */
function corrBorderColor(val: number | null): string {
  const s = corrStrength(val);
  if (s === "strong") return "border-green-500/30";
  if (s === "moderate") return "border-yellow-500/30";
  return "border-gray-300 dark:border-gray-700";
}

/** Format a number to 1 decimal, or "--" if null. */
function fmt(val: number | null, decimals = 1): string {
  if (val === null || val === undefined) return "--";
  return val.toFixed(decimals);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const Reports: Component = () => {
  const [days, setDays] = createSignal<number>(30);

  const [report] = createResource(days, (d) => getAnalysisReport(d));

  const insufficientData = () => {
    const r = report();
    return r ? r.dataPoints < 14 : false;
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div class="pb-24 md:pb-8 md:ml-56">
      <div class="max-w-3xl mx-auto px-4 py-6">
        {/* ---- Header ---- */}
        <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Reports
        </h1>

        {/* ============================================================ */}
        {/* PERIOD SELECTOR                                              */}
        {/* ============================================================ */}
        <div class="flex gap-2 mb-6">
          <For each={[...PERIOD_OPTIONS]}>
            {(opt) => (
              <button
                class={`touch-target px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  days() === opt
                    ? "bg-blue-600 text-white dark:bg-blue-500"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                }`}
                onClick={() => setDays(opt)}
              >
                {opt} Days
              </button>
            )}
          </For>
        </div>

        {/* ---- Loading state ---- */}
        <Show when={report.loading}>
          <div class="space-y-4">
            <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4" />
              <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            </div>
            <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4" />
              <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            </div>
          </div>
        </Show>

        {/* ---- Error state ---- */}
        <Show when={report.error}>
          <div class="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-6 text-center">
            <p class="text-red-600 dark:text-red-400 text-sm">
              Failed to load report. Please try again later.
            </p>
          </div>
        </Show>

        <Show when={report() && !report.loading && !report.error}>
          {/* ============================================================ */}
          {/* INSUFFICIENT DATA STATE                                      */}
          {/* ============================================================ */}
          <Show when={insufficientData()}>
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center mb-6">
              <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 13h2v8H3zm6-4h2v12H9zm6-6h2v18h-2zm6 10h2v8h-2z" />
              </svg>
              <p class="text-gray-700 dark:text-gray-200 font-medium mb-2">
                Need at least 14 days of data for analysis. Keep logging!
              </p>
              {/* Progress bar */}
              <div class="max-w-xs mx-auto">
                <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>{report()!.dataPoints}/14 days logged</span>
                  <span>{Math.round((report()!.dataPoints / 14) * 100)}%</span>
                </div>
                <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (report()!.dataPoints / 14) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </Show>

          {/* ============================================================ */}
          {/* WEIGHT TREND CARD                                            */}
          {/* ============================================================ */}
          <Show when={!insufficientData()}>
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-4">
              <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Weight Trend
              </h2>
              <div class="flex items-end gap-6 mb-3">
                {/* Current avg */}
                <div>
                  <div class="text-3xl font-bold text-gray-900 dark:text-white">
                    {fmt(report()!.weightTrend.current7DayAvg)}
                    <span class="text-base font-normal text-gray-500 dark:text-gray-400 ml-1">lbs</span>
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">7-day avg</div>
                </div>
                {/* Delta */}
                <Show when={report()!.weightTrend.delta !== null}>
                  <div class="flex items-center gap-1">
                    <span
                      class={`text-lg font-semibold ${
                        report()!.weightTrend.trend === "down"
                          ? "text-green-500"
                          : report()!.weightTrend.trend === "up"
                            ? "text-red-500"
                            : "text-gray-400"
                      }`}
                    >
                      {report()!.weightTrend.trend === "down"
                        ? "\u2193"
                        : report()!.weightTrend.trend === "up"
                          ? "\u2191"
                          : "\u2192"}
                      {" "}{fmt(Math.abs(report()!.weightTrend.delta!))}
                    </span>
                  </div>
                </Show>
              </div>
              {/* Previous avg label */}
              <Show when={report()!.weightTrend.previous7DayAvg !== null}>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  Previous 7-day avg: {fmt(report()!.weightTrend.previous7DayAvg)} lbs
                </div>
              </Show>
            </div>

            {/* ============================================================ */}
            {/* MACRO AVERAGES CARD                                          */}
            {/* ============================================================ */}
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-4">
              <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                Daily Macro Averages
              </h2>
              <div class="space-y-3">
                <MacroBar
                  label="Calories"
                  value={report()!.macroAverages.calories}
                  max={3000}
                  unit="cal"
                  color="bg-orange-500"
                />
                <MacroBar
                  label="Protein"
                  value={report()!.macroAverages.protein}
                  max={250}
                  unit="g"
                  color="bg-blue-500"
                />
                <MacroBar
                  label="Carbs"
                  value={report()!.macroAverages.carbs}
                  max={400}
                  unit="g"
                  color="bg-yellow-500"
                />
                <MacroBar
                  label="Fat"
                  value={report()!.macroAverages.fat}
                  max={150}
                  unit="g"
                  color="bg-red-500"
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/* CORRELATIONS SECTION                                         */}
            {/* ============================================================ */}
            <div class="mb-4">
              <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Correlations
              </h2>
              <Show
                when={report()!.correlations.length > 0}
                fallback={
                  <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No correlation data available yet.
                  </div>
                }
              >
                <div class="space-y-3">
                  <For each={report()!.correlations}>
                    {(corr) => <CorrelationCard corr={corr} />}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* MacroBar sub-component                                              */
/* ------------------------------------------------------------------ */

function MacroBar(props: {
  label: string;
  value: number | null;
  max: number;
  unit: string;
  color: string;
}) {
  const pct = () => {
    if (props.value === null) return 0;
    return Math.min(100, (props.value / props.max) * 100);
  };

  return (
    <div>
      <div class="flex justify-between text-sm mb-1">
        <span class="text-gray-700 dark:text-gray-300">{props.label}</span>
        <span class="font-medium text-gray-900 dark:text-white">
          {fmt(props.value, 0)} {props.unit}
        </span>
      </div>
      <div class="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          class={`h-full rounded-full transition-all ${props.color}`}
          style={{ width: `${pct()}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CorrelationCard sub-component                                       */
/* ------------------------------------------------------------------ */

function CorrelationCard(props: { corr: CorrelationResult }) {
  const title = () =>
    `${metricLabel(props.corr.metric1)} vs ${metricLabel(props.corr.metric2)}`;

  /** Position the marker on the -1 to +1 gauge (0% to 100%). */
  const markerPct = () => {
    if (props.corr.correlation === null) return 50;
    return ((props.corr.correlation + 1) / 2) * 100;
  };

  return (
    <div
      class={`rounded-xl border bg-white dark:bg-gray-800 p-4 ${corrBorderColor(props.corr.correlation)}`}
    >
      {/* Title row */}
      <div class="flex items-start justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {title()}
        </h3>
        <Show
          when={props.corr.correlation !== null}
          fallback={
            <span class="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded px-2 py-0.5">
              N/A
            </span>
          }
        >
          <span
            class={`text-xs font-bold rounded px-2 py-0.5 text-white ${corrColor(props.corr.correlation)}`}
          >
            {props.corr.correlation!.toFixed(2)}
          </span>
        </Show>
      </div>

      {/* Gauge */}
      <Show
        when={props.corr.correlation !== null}
        fallback={
          <div class="text-sm text-gray-500 dark:text-gray-400 italic mb-2">
            Insufficient data to calculate correlation.
          </div>
        }
      >
        <div class="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full mb-3 overflow-visible">
          {/* Background zones: red | yellow | grey | yellow | red */}
          <div class="absolute inset-0 rounded-full flex overflow-hidden">
            <div class="w-[12.5%] bg-red-400/30" />
            <div class="w-[12.5%] bg-yellow-400/30" />
            <div class="w-[25%] bg-gray-300/30 dark:bg-gray-600/30" />
            <div class="w-[25%] bg-gray-300/30 dark:bg-gray-600/30" />
            <div class="w-[12.5%] bg-yellow-400/30" />
            <div class="w-[12.5%] bg-red-400/30" />
          </div>
          {/* Center line at 0 */}
          <div class="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500" />
          {/* Marker */}
          <div
            class={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 shadow ${corrColor(props.corr.correlation)}`}
            style={{ left: `calc(${markerPct()}% - 7px)` }}
          />
        </div>
        <div class="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mb-2">
          <span>-1.0</span>
          <span>0</span>
          <span>+1.0</span>
        </div>
      </Show>

      {/* Interpretation */}
      <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">
        {props.corr.interpretation}
      </p>

      {/* Meta */}
      <div class="text-xs text-gray-400 dark:text-gray-500">
        {props.corr.dataPoints} data points &middot;{" "}
        {props.corr.period.start} to {props.corr.period.end}
      </div>
    </div>
  );
}

export default Reports;
