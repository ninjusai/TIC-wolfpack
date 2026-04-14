import { createSignal, onMount, onCleanup } from "solid-js";
import { replayMutations } from "./offline-queue";

export function createConnectivitySignal(): { isOnline: () => boolean } {
  const [isOnline, setIsOnline] = createSignal(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  onMount(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Replay queued mutations when connectivity is restored
      replayMutations().catch(() => {
        /* best effort */
      });
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    onCleanup(() => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    });
  });

  return { isOnline };
}
