/**
 * Toast notification component (WRK-027).
 *
 * Simple signal-based toast that shows at the bottom of the screen
 * above the mobile nav. Auto-dismisses after a configurable duration.
 */
import { createSignal, Show, type JSX } from "solid-js";

/* ------------------------------------------------------------------ */
/* Shared toast state                                                 */
/* ------------------------------------------------------------------ */

const [toast, setToast] = createSignal<{
  message: string;
  visible: boolean;
}>({ message: "", visible: false });

let dismissTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Show a toast message. Auto-dismisses after `duration` ms (default 2000).
 */
export function showToast(message: string, duration = 2000): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  setToast({ message, visible: true });
  dismissTimer = setTimeout(() => {
    setToast({ message: "", visible: false });
  }, duration);
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function Toast(): JSX.Element {
  return (
    <Show when={toast().visible}>
      <div
        class="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-60 px-4 py-2.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium shadow-lg max-w-xs text-center animate-fade-in"
        style={{
          animation: "toast-in 0.2s ease-out",
        }}
      >
        <div class="flex items-center gap-2">
          <svg
            class="w-4 h-4 text-green-400 dark:text-green-600 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>{toast().message}</span>
        </div>
      </div>
    </Show>
  );
}
