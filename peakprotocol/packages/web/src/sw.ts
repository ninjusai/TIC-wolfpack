/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from "workbox-strategies";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { ExpirationPlugin } from "workbox-expiration";

// ──────────────────────────────────────────────
// 1. Precache build output (Vite injects the manifest)
// ──────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST);

// ──────────────────────────────────────────────
// 2. Static assets — CacheFirst (versioned by hash, long-lived)
// ──────────────────────────────────────────────
registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image",
  new CacheFirst({
    cacheName: "peakprotocol-static",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  }),
);

// ──────────────────────────────────────────────
// 3. API calls — NetworkFirst (fresh when online, cached offline)
// ──────────────────────────────────────────────
registerRoute(
  ({ url, request }) => url.pathname.startsWith("/api/") && request.method === "GET",
  new NetworkFirst({
    cacheName: "peakprotocol-api",
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  }),
);

// ──────────────────────────────────────────────
// 4. Navigation — StaleWhileRevalidate (instant load, bg refresh)
// ──────────────────────────────────────────────
registerRoute(
  new NavigationRoute(
    new StaleWhileRevalidate({
      cacheName: "peakprotocol-navigation",
    }),
  ),
);

// ──────────────────────────────────────────────
// 5. Background sync for mutations (POST/PUT/DELETE)
// ──────────────────────────────────────────────
const bgSyncPlugin = new BackgroundSyncPlugin("peakprotocol-sync", {
  maxRetentionTime: 60 * 24 * 7, // 7 days in minutes
});

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/api/") &&
    ["POST", "PUT", "DELETE"].includes(request.method),
  new NetworkFirst({
    cacheName: "peakprotocol-api-mutations",
    plugins: [bgSyncPlugin],
  }),
  "POST",
);

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/api/") &&
    ["POST", "PUT", "DELETE"].includes(request.method),
  new NetworkFirst({
    cacheName: "peakprotocol-api-mutations",
    plugins: [bgSyncPlugin],
  }),
  "PUT",
);

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/api/") &&
    ["POST", "PUT", "DELETE"].includes(request.method),
  new NetworkFirst({
    cacheName: "peakprotocol-api-mutations",
    plugins: [bgSyncPlugin],
  }),
  "DELETE",
);

// ──────────────────────────────────────────────
// 6. Offline fallback — serve the app shell
// ──────────────────────────────────────────────
self.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/index.html").then(
          (response) => response ?? new Response("Offline", { status: 503 }),
        ),
      ),
    );
  }
});

// ──────────────────────────────────────────────
// 7. Activate immediately — claim all clients
// ──────────────────────────────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});
