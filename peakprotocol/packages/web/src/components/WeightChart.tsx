/**
 * Weight trend chart component using uPlot (WRK-029).
 *
 * Renders a line chart of daily weight data with a linear-regression trend
 * line. Includes a range selector (2W / 1M / 3M) and responsive resizing.
 */
import {
  createSignal,
  createResource,
  createEffect,
  on,
  onCleanup,
  Show,
  For,
  type Component,
} from "solid-js";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import "../styles/weight-chart.css";
import { apiFetch } from "../lib/api";
import { calculateTrendLine } from "../lib/stats";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WeightChartProps {
  startDate: string; // YYYY-MM-DD (initial; overridden by range selector)
  endDate: string; // YYYY-MM-DD
  unit: string; // 'kg' or 'lbs'
}

interface DailyMetrics {
  date: string;
  weight: number | null;
  weightUnit: string;
  waterMl: number | null;
  waterTargetMl: number | null;
  notes: string | null;
  tags: string[];
  loggedAt: string;
}

interface MetricsResponse {
  metrics: DailyMetrics[];
}

type RangeKey = "2W" | "1M" | "3M";

const RANGE_DAYS: Record<RangeKey, number> = {
  "2W": 14,
  "1M": 30,
  "3M": 90,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Format YYYY-MM-DD from a Date. */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build start date N days before end. */
function dateMinusDays(end: string, days: number): string {
  const d = new Date(end + "T00:00:00");
  d.setDate(d.getDate() - days);
  return fmtDate(d);
}

/** YYYY-MM-DD -> Unix seconds at midnight UTC. */
function dateToUnix(dateStr: string): number {
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const WeightChart: Component<WeightChartProps> = (props) => {
  let containerRef!: HTMLDivElement;
  let chartInstance: uPlot | null = null;

  const [activeRange, setActiveRange] = createSignal<RangeKey>("1M");
  const [computedStart, setComputedStart] = createSignal(
    dateMinusDays(props.endDate, 30),
  );

  // Update computed start when range changes
  createEffect(
    on(activeRange, (range) => {
      setComputedStart(dateMinusDays(props.endDate, RANGE_DAYS[range]));
    }),
  );

  /* ---- Data fetching ---- */

  const fetchMetrics = async (start: string): Promise<MetricsResponse> => {
    return apiFetch<MetricsResponse>(
      `/api/metrics?startDate=${start}&endDate=${props.endDate}`,
    );
  };

  const [metricsData, { refetch }] = createResource(computedStart, fetchMetrics);

  // Refetch when computedStart changes (range selector)
  createEffect(
    on(computedStart, () => {
      refetch();
    }),
  );

  /* ---- Chart rendering ---- */

  function buildChart() {
    const raw = metricsData();
    if (!raw || !containerRef) return;

    // Filter to entries with non-null weight
    const entries = raw.metrics;
    if (!entries.length) return;

    // Build aligned arrays — include all dates, null weights become gaps
    const timestamps: number[] = [];
    const weights: (number | null)[] = [];

    for (const entry of entries) {
      timestamps.push(dateToUnix(entry.date));
      weights.push(entry.weight);
    }

    // Trend line
    const trend = calculateTrendLine(timestamps, weights);

    // uPlot expects AlignedData: [timestamps[], series1[], series2[], ...]
    // For gaps, uPlot uses undefined in typed arrays — we convert nulls
    const uTimestamps = timestamps;
    const uWeights = weights.map((v) => (v == null ? undefined : v)) as (
      | number
      | undefined
    )[];
    const uTrend = trend.map((v) => (v == null ? undefined : v)) as (
      | number
      | undefined
    )[];

    const data: uPlot.AlignedData = [
      uTimestamps,
      uWeights as number[],
      uTrend as number[],
    ];

    const unitLabel = props.unit === "lbs" ? "lbs" : "kg";

    const opts: uPlot.Options = {
      width: containerRef.clientWidth,
      height: 280,
      class: "weight-chart",
      cursor: {
        drag: { x: false, y: false },
      },
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        {
          // X-axis: dates
          stroke: "var(--chart-axis, #888)",
          grid: { stroke: "var(--chart-grid, rgba(136,136,136,0.15))", width: 1 },
          ticks: { stroke: "var(--chart-grid, rgba(136,136,136,0.15))", width: 1 },
          font: "12px inherit",
          values: (_self: uPlot, splits: number[]) =>
            splits.map((v) => {
              const d = new Date(v * 1000);
              return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
            }),
        },
        {
          // Y-axis: weight
          label: unitLabel,
          labelFont: "bold 12px inherit",
          stroke: "var(--chart-axis, #888)",
          grid: { stroke: "var(--chart-grid, rgba(136,136,136,0.15))", width: 1 },
          ticks: { stroke: "var(--chart-grid, rgba(136,136,136,0.15))", width: 1 },
          font: "12px inherit",
          size: 56,
        },
      ],
      series: [
        {}, // x-axis series (timestamps)
        {
          label: "Weight",
          stroke: "var(--chart-accent, #3b82f6)",
          width: 2,
          points: { show: true, size: 6, fill: "var(--chart-accent, #3b82f6)" },
          spanGaps: false,
        },
        {
          label: "Trend",
          stroke: "var(--chart-trend, rgba(59,130,246,0.4))",
          width: 2,
          dash: [6, 4],
          points: { show: false },
          spanGaps: true,
        },
      ],
      plugins: [tooltipPlugin()],
    };

    // Destroy previous instance
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    chartInstance = new uPlot(opts, data, containerRef);
  }

  // Rebuild chart when data arrives or changes
  createEffect(
    on(
      () => metricsData(),
      () => {
        if (!metricsData.loading && metricsData()) {
          // Small delay to ensure container is in DOM
          queueMicrotask(buildChart);
        }
      },
    ),
  );

  /* ---- Responsive resize ---- */

  createEffect(() => {
    if (!containerRef) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (chartInstance && entry.contentRect.width > 0) {
          chartInstance.setSize({
            width: entry.contentRect.width,
            height: 280,
          });
        }
      }
    });

    observer.observe(containerRef);
    onCleanup(() => observer.disconnect());
  });

  // Cleanup chart on unmount
  onCleanup(() => {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  });

  /* ---- Range selector handler ---- */

  function onRangeClick(range: RangeKey) {
    setActiveRange(range);
  }

  /* ---- Render ---- */

  return (
    <div class="weight-chart-wrapper">
      {/* Range selector */}
      <div class="weight-chart-ranges" role="group" aria-label="Date range selector">
        <For each={Object.keys(RANGE_DAYS) as RangeKey[]}>
          {(range) => (
            <button
              class={`weight-chart-range-btn ${activeRange() === range ? "active" : ""}`}
              onClick={() => onRangeClick(range)}
              aria-pressed={activeRange() === range}
            >
              {range}
            </button>
          )}
        </For>
      </div>

      {/* Loading skeleton */}
      <Show when={metricsData.loading}>
        <div class="weight-chart-skeleton" aria-label="Loading weight chart">
          <div class="weight-chart-skeleton-bar" />
          <div class="weight-chart-skeleton-bar short" />
          <div class="weight-chart-skeleton-bar" />
          <div class="weight-chart-skeleton-bar short" />
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!metricsData.loading && metricsData()?.metrics.length === 0}>
        <div class="weight-chart-empty">
          No weight data for this period.
        </div>
      </Show>

      {/* Chart container */}
      <div
        ref={containerRef}
        class="weight-chart-container"
        aria-label={`Weight trend chart in ${props.unit} for the last ${RANGE_DAYS[activeRange()]} days`}
        role="img"
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Tooltip plugin                                                     */
/* ------------------------------------------------------------------ */

function tooltipPlugin(): uPlot.Plugin {
  let tooltip: HTMLDivElement | null = null;

  function init(u: uPlot) {
    tooltip = document.createElement("div");
    tooltip.className = "weight-chart-tooltip";
    tooltip.style.display = "none";
    u.over.appendChild(tooltip);

    // Touch-friendly: make the cursor area larger
    u.over.style.touchAction = "pan-x";
  }

  function setCursor(u: uPlot) {
    if (!tooltip) return;

    const idx = u.cursor.idx;
    if (idx == null) {
      tooltip.style.display = "none";
      return;
    }

    const ts = u.data[0][idx];
    const val = u.data[1][idx];

    if (val == null || val === undefined) {
      tooltip.style.display = "none";
      return;
    }

    const d = new Date(ts * 1000);
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

    tooltip.innerHTML = `<strong>${dateStr}</strong><br/>${(val as number).toFixed(1)}`;
    tooltip.style.display = "block";

    const left = u.valToPos(ts, "x");
    const top = u.valToPos(val as number, "y");

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top - 40}px`;
  }

  return {
    hooks: {
      init,
      setCursor,
    },
  };
}

export default WeightChart;
