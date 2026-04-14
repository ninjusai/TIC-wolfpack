/**
 * SupplementDots — colored dot indicators for calendar day cells (WRK-PP6-016).
 *
 * Renders a row of colored circles representing scheduled supplements for a day.
 * Each dot uses the supplement's palette color. A status ring indicates:
 *   - green ring = taken
 *   - amber ring = skipped
 *   - no ring (gray outline) = pending
 *
 * Responsive: max 6 dots on mobile (<640px), max 8 on desktop.
 * Overflow shown as "+N" indicator.
 *
 * Dot size: 6px mobile, 8px desktop.
 */
import { For, Show, createMemo, type JSX } from "solid-js";
import type { DaySupplementStatus } from "../lib/supplements";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface SupplementDotsProps {
  /** Supplement statuses for this day */
  supplements: DaySupplementStatus[];
  /** Whether the parent day cell is currently selected */
  isSelected?: boolean;
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_DOTS_MOBILE = 6;
const MAX_DOTS_DESKTOP = 8;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusRingClass(status: DaySupplementStatus["status"]): string {
  switch (status) {
    case "taken":
      return "ring-1 ring-green-500";
    case "skipped":
      return "ring-1 ring-amber-500";
    case "pending":
    default:
      return "ring-1 ring-gray-400 dark:ring-gray-500";
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function SupplementDots(props: SupplementDotsProps): JSX.Element {
  const visibleMobile = createMemo(() =>
    props.supplements.slice(0, MAX_DOTS_MOBILE),
  );
  const visibleDesktop = createMemo(() =>
    props.supplements.slice(0, MAX_DOTS_DESKTOP),
  );

  const overflowMobile = createMemo(() =>
    Math.max(0, props.supplements.length - MAX_DOTS_MOBILE),
  );
  const overflowDesktop = createMemo(() =>
    Math.max(0, props.supplements.length - MAX_DOTS_DESKTOP),
  );

  return (
    <Show when={props.supplements.length > 0}>
      {/* Mobile dots (< 640px) */}
      <div
        class="flex items-center justify-center gap-0.5 sm:hidden mt-0.5"
        aria-label={`${props.supplements.length} supplement${props.supplements.length !== 1 ? "s" : ""}`}
      >
        <For each={visibleMobile()}>
          {(supp) => (
            <span
              class={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusRingClass(supp.status)}`}
              style={{ "background-color": supp.color }}
              title={`${supp.name}: ${supp.status}`}
            />
          )}
        </For>
        <Show when={overflowMobile() > 0}>
          <span
            class={`text-[8px] leading-none font-medium flex-shrink-0 ${
              props.isSelected
                ? "text-blue-700"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            +{overflowMobile()}
          </span>
        </Show>
      </div>

      {/* Desktop dots (>= 640px) */}
      <div
        class="hidden sm:flex items-center justify-center gap-0.5 mt-0.5"
        aria-label={`${props.supplements.length} supplement${props.supplements.length !== 1 ? "s" : ""}`}
      >
        <For each={visibleDesktop()}>
          {(supp) => (
            <span
              class={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusRingClass(supp.status)}`}
              style={{ "background-color": supp.color }}
              title={`${supp.name}: ${supp.status}`}
            />
          )}
        </For>
        <Show when={overflowDesktop() > 0}>
          <span
            class={`text-[9px] leading-none font-medium flex-shrink-0 ${
              props.isSelected
                ? "text-blue-700"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            +{overflowDesktop()}
          </span>
        </Show>
      </div>
    </Show>
  );
}
