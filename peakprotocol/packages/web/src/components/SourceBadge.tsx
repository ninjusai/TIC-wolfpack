/**
 * Food source badge component (WRK-PP6-023).
 *
 * Displays a compact badge indicating the source of food
 * nutritional data: "USDA", "OFF", "AI", or "Manual".
 * Pre-Phase-6 entries with null source default to "USDA".
 */
import type { JSX } from "solid-js";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type FoodSource = "usda" | "off" | "ai" | "manual";

interface SourceBadgeProps {
  /** The source value from FoodEntry.source (nullable). */
  source: string | null | undefined;
}

/* ------------------------------------------------------------------ */
/* Config                                                             */
/* ------------------------------------------------------------------ */

interface BadgeConfig {
  label: string;
  bg: string;
  text: string;
  darkBg: string;
  darkText: string;
}

const BADGE_MAP: Record<string, BadgeConfig> = {
  usda: {
    label: "USDA",
    bg: "bg-green-100",
    text: "text-green-700",
    darkBg: "dark:bg-green-900/30",
    darkText: "dark:text-green-400",
  },
  off: {
    label: "OFF",
    bg: "bg-purple-100",
    text: "text-purple-700",
    darkBg: "dark:bg-purple-900/30",
    darkText: "dark:text-purple-400",
  },
  ai: {
    label: "AI",
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    darkBg: "dark:bg-cyan-900/30",
    darkText: "dark:text-cyan-400",
  },
  manual: {
    label: "Manual",
    bg: "bg-amber-100",
    text: "text-amber-700",
    darkBg: "dark:bg-amber-900/30",
    darkText: "dark:text-amber-400",
  },
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function SourceBadge(props: SourceBadgeProps): JSX.Element {
  const config = (): BadgeConfig => {
    const key = (props.source ?? "usda").toLowerCase();
    return BADGE_MAP[key] ?? BADGE_MAP.usda;
  };

  return (
    <span
      class={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-tight ${config().bg} ${config().text} ${config().darkBg} ${config().darkText}`}
      aria-label={`Source: ${config().label}`}
    >
      {config().label}
    </span>
  );
}
