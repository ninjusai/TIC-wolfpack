/**
 * Service Worker Registration
 *
 * Registers the SW on app startup and handles update prompts.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  // Skip SW registration in development — vite-plugin-pwa handles dev mode separately
  // and InjectManifest only produces sw.js during production builds
  if (import.meta.env.DEV) {
    console.info("[SW] Skipping registration in development mode");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    // Check for updates on visibility change (user returns to tab)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        registration.update();
      }
    });

    // Handle waiting service worker (new version available)
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          // New content is available — prompt user to refresh
          if (confirm("A new version of PeakProtocol is available. Reload?")) {
            newWorker.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          }
        }
      });
    });

    console.info("[SW] Registered:", registration.scope);
  } catch (error) {
    console.error("[SW] Registration failed:", error);
  }
}
