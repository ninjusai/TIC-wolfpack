import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import { createConnectivitySignal } from "../lib/connectivity";
import { getQueueCount } from "../lib/offline-queue";

type BannerState = "hidden" | "offline" | "syncing" | "synced";

export default function OfflineIndicator() {
  const { isOnline } = createConnectivitySignal();
  const [bannerState, setBannerState] = createSignal<BannerState>("hidden");
  const [pendingCount, setPendingCount] = createSignal(0);
  let dismissTimer: ReturnType<typeof setTimeout> | undefined;

  // Poll pending count while offline
  let pollTimer: ReturnType<typeof setTimeout> | undefined;

  function startPolling() {
    const tick = () => {
      getQueueCount().then(setPendingCount).catch(() => {});
      pollTimer = setTimeout(tick, 2000);
    };
    tick();
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = undefined;
    }
  }

  createEffect(() => {
    const online = isOnline();

    if (!online) {
      // Went offline
      if (dismissTimer) clearTimeout(dismissTimer);
      setBannerState("offline");
      startPolling();
    } else if (bannerState() === "offline") {
      // Was offline, now online — show syncing then synced
      stopPolling();
      setBannerState("syncing");

      // After a short delay, show synced
      dismissTimer = setTimeout(() => {
        setBannerState("synced");
        dismissTimer = setTimeout(() => {
          setBannerState("hidden");
        }, 3000);
      }, 1500);
    }
  });

  onCleanup(() => {
    stopPolling();
    if (dismissTimer) clearTimeout(dismissTimer);
  });

  const bannerStyles: Record<Exclude<BannerState, "hidden">, string> = {
    offline: "background:#f59e0b;color:#78350f",
    syncing: "background:#3b82f6;color:#fff",
    synced: "background:#22c55e;color:#fff",
  };

  return (
    <Show when={bannerState() !== "hidden"}>
      <div
        role="status"
        aria-live="polite"
        style={`${bannerStyles[bannerState() as Exclude<BannerState, "hidden">]};position:fixed;top:0;left:0;right:0;z-index:9999;text-align:center;padding:8px 16px;font-size:14px;font-weight:500`}
      >
        <Show when={bannerState() === "offline"}>
          You're offline — changes will sync when connected
          <Show when={pendingCount() > 0}>
            {" "}
            <span style="margin-left:8px;font-weight:700">
              {pendingCount()} change{pendingCount() !== 1 ? "s" : ""} pending
            </span>
          </Show>
        </Show>
        <Show when={bannerState() === "syncing"}>
          Back online — syncing...
        </Show>
        <Show when={bannerState() === "synced"}>
          All synced!
        </Show>
      </div>
    </Show>
  );
}
