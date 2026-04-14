/**
 * NotificationManager — SolidJS component for Web Push subscription (WRK-019).
 *
 * Provides a UI to enable/disable push notifications:
 *   - Checks Push API support
 *   - Fetches VAPID public key from the API
 *   - Manages browser permission + push subscription lifecycle
 *   - Syncs subscription state with the backend
 */
import { createSignal, onMount, Show } from "solid-js";
import { urlBase64ToUint8Array } from "../lib/push";
import { apiFetch } from "../lib/api";

// ── Types ────────────────────────────────────────────────────────────

type PushStatus = "loading" | "unsupported" | "denied" | "enabled" | "disabled";

// ── Component ────────────────────────────────────────────────────────

export default function NotificationManager() {
  const [status, setStatus] = createSignal<PushStatus>("loading");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    // Check browser support
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    // Check if permission was previously denied
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    // Check if already subscribed
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        // Verify backend knows about it
        try {
          const data = await apiFetch<{ subscribed: boolean }>("/api/push/status");
          setStatus(data.subscribed ? "enabled" : "disabled");
        } catch {
          setStatus("disabled");
        }
      } else {
        setStatus("disabled");
      }
    } catch {
      setStatus("disabled");
    }
  });

  async function enableNotifications() {
    setLoading(true);
    setError(null);

    try {
      // 1. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      // 2. Fetch VAPID public key from API
      const { publicKey } = await apiFetch<{ publicKey: string }>("/api/push/vapid-key");

      // 3. Subscribe via Push API
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 4. Send subscription to backend
      const subJson = subscription.toJSON();
      await apiFetch("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          subscription: {
            endpoint: subJson.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh ?? "",
              auth: subJson.keys?.auth ?? "",
            },
          },
        }),
      });

      setStatus("enabled");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      console.error("[NotificationManager] enable failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function disableNotifications() {
    setLoading(true);
    setError(null);

    try {
      // 1. Unsubscribe from Push API
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // 2. Remove from backend
      await apiFetch("/api/push/unsubscribe", {
        method: "DELETE",
      });

      setStatus("disabled");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      console.error("[NotificationManager] disable failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="notification-manager">
      <h3>Push Notifications</h3>

      <Show when={status() === "loading"}>
        <p>Checking notification status...</p>
      </Show>

      <Show when={status() === "unsupported"}>
        <p>Push notifications are not supported in this browser.</p>
      </Show>

      <Show when={status() === "denied"}>
        <p>
          Notification permission was denied. Please enable notifications in
          your browser settings and reload the page.
        </p>
      </Show>

      <Show when={status() === "disabled"}>
        <button
          onClick={enableNotifications}
          disabled={loading()}
        >
          {loading() ? "Enabling..." : "Enable Notifications"}
        </button>
      </Show>

      <Show when={status() === "enabled"}>
        <p>Notifications are enabled.</p>
        <button
          onClick={disableNotifications}
          disabled={loading()}
        >
          {loading() ? "Disabling..." : "Disable Notifications"}
        </button>
      </Show>

      <Show when={error()}>
        <p class="error">{error()}</p>
      </Show>
    </div>
  );
}
