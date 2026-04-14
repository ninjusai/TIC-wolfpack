# Skills Research: Pixel
**Date:** 2026-04-01
**Requested By:** Peter (via Alpha)
**For Role:** Pixel - Frontend UI/UX Specialist for PeakProtocol

## Core Technical Skills

### 1. SolidJS Reactivity System (Primary Framework)
- **createSignal** for primitive state (weight, hydration values, form inputs). Always call as functions: count() not count. Never destructure props — breaks reactivity tracking.
- **createStore** for nested/complex state (supplement lists, food logs, training records). Use produce() for immutable-style mutations on deep objects.
- **createMemo** for derived/computed values (daily compliance %, weekly averages, streak counts). Caches until dependencies change — prevents redundant recalculation.
- **createEffect** for side effects (syncing to IndexedDB, updating document title, triggering sync). Runs after render, auto-tracks signal dependencies.
- **createResource** for async data fetching with built-in loading/error states and Suspense integration. Use for USDA food search, correlation report generation, any async operation.
- **Flow components**: Show (conditional), For (list iteration with keyed updates), Switch/Match (multi-branch), Index (for non-keyed lists). These are NOT just syntax sugar — Solid optimizes them at compile time.
- **lazy()** + dynamic import() for code splitting. Wrap route-level components: `const Dashboard = lazy(() => import('./pages/Dashboard'))`.
- **Suspense** boundaries around lazy components and createResource consumers. Use fallback prop for loading skeletons. Nest Suspense for granular loading states.
- **Context providers** for cross-cutting concerns (theme, online/offline status, sync state). Use sparingly — signals + stores are usually better.

### 2. UnoCSS with Wind3 (Tailwind-compatible) Preset
- Use @unocss/preset-wind3 for Tailwind CSS compatibility (utility classes, responsive prefixes, dark mode).
- **Mobile-first breakpoints**: Default styles target mobile (320px+), then sm:, md:, lg: for progressively larger screens. Configure custom breakpoints: sm: 480px, md: 768px, lg: 1024px.
- **Dark mode**: Class-based by default (dark: variant). Configure with html.dark class toggle.
- **Shortcuts** for component patterns: define reusable utility combos like `'btn-primary': 'px-4 py-3 rounded-lg bg-blue-600 text-white font-semibold min-h-[44px] min-w-[44px]'` (note 44px touch targets baked in).
- **Extractors**: UnoCSS scans source files for class usage. Ensure .tsx files are included in content config.
- **Safelist**: Pre-include dynamic classes that can't be statically analyzed (e.g., color-{tag} for journal tags).
- **Theme configuration**: Extend theme in uno.config.ts for custom colors, spacing, fonts specific to PeakProtocol brand.

### 3. uPlot Charting (via @dschz/solid-uplot)
- Use @dschz/solid-uplot — the actively maintained SolidJS wrapper with reactive plugin system.
- **Lifecycle pattern**: Chart creates on mount (onMount), updates reactively when signal data changes, destroys on cleanup (onCleanup). The wrapper handles this automatically.
- **Chart types needed**: Line charts (weight trends, hydration over time), bar charts (training volume), area charts (supplement compliance over time).
- **Series configuration**: Each data series has scale key, stroke color, fill, width, label. Multiple y-axes for different units (kg vs liters vs percentage).
- **Responsive resizing**: Use @dschz/solid-auto-sizer or @solid-primitives/resize-observer (createElementSize) to get container dimensions as signals, feed to uPlot width/height.
- **Touch interaction**: uPlot supports touch cursor/tooltip natively. Configure cursor.drag for zoom gestures on mobile.
- **Trend lines**: Calculate externally (simple linear regression: slope = sum((xi-xmean)(yi-ymean)) / sum((xi-xmean)^2)) and add as additional series with dashed stroke.
- **Correlation charts**: Scatter plots via uPlot paths plugin with custom drawPoints renderer.
- **Performance**: uPlot renders via Canvas 2D — handles thousands of points at 60fps. ~35KB minified, well within budget.

### 4. Service Worker + Workbox (via vite-plugin-pwa)
- Use **vite-plugin-pwa** with `strategies: 'injectManifest'` for full control over service worker logic.
- **SolidJS integration**: Import from `virtual:pwa-register/solid` — provides createSignal-based offlineReady and needRefresh signals.
- **Cache strategies**:
  - CacheFirst for static assets (JS, CSS, images, fonts) — immutable once versioned.
  - NetworkFirst for API responses (supplement data, food search results) — fresh when online, cached when offline.
  - StaleWhileRevalidate for non-critical dynamic content — instant load, background refresh.
- **Precaching**: vite-plugin-pwa auto-generates precache manifest from Vite build output. All route chunks, CSS, and critical assets precached on SW install.
- **Offline fallback**: Register a catch handler that serves cached app shell when network fails.
- **Background sync**: Use workbox-background-sync plugin to queue failed POST/PUT requests and replay when online. Configure maxRetentionTime (e.g., 7 days).
- **Navigation preload**: Enable for faster navigation when online by starting network request in parallel with SW boot.
- Add workbox-window as dev dependency for SW registration and update lifecycle.

### 5. IndexedDB Offline Queue (via idb library)
- Use **idb** (~1.2KB gzipped) — lightweight Promise wrapper around IndexedDB. Avoids heavyweight alternatives.
- **Schema design for pending mutations**:
  - Store: 'syncQueue' with autoIncrement key
  - Fields: id (auto), entityType (supplement|food|weight|training|journal), entityId, operation (create|update|delete), payload (JSON), timestamp, retryCount, status (pending|syncing|failed|complete)
  - Index on: status + timestamp for ordered replay
- **Replay strategy**: On connectivity restored, read all 'pending' items ordered by timestamp, replay sequentially (preserve causal order), mark 'complete' on success, increment retryCount on failure, mark 'failed' after 3 retries.
- **Conflict resolution**: Last-Write-Wins (LWW) using modified_at timestamps. Simple, predictable, appropriate for single-user app. Server timestamp wins ties.
- **Storage quota detection**: Use navigator.storage.estimate() to check available space. Warn user when >80% full. Request persistent storage via navigator.storage.persist().
- **Optimistic UI**: Write to IndexedDB immediately, update UI optimistically, queue sync in background. UI always reads from local DB first.

### 6. PWA Infrastructure
- **manifest.json required fields**: name, short_name, description, start_url: '/', display: 'standalone', background_color, theme_color, icons array, id.
- **Icons**: 192x192 (required), 512x512 (required), plus maskable variants. Use purpose: 'any maskable' or separate icon entries. Maskable safe zone is inner 80% circle.
- **Advanced manifest**: Add shortcuts (quick actions), screenshots (install UI), categories, launch_handler.
- **Lighthouse PWA audit checklist**: HTTPS, valid manifest, registered SW with fetch handler, 200 when offline, viewport meta, theme-color meta, apple-touch-icon, maskable icon, redirects HTTP to HTTPS.
- **Install prompt**: Listen for beforeinstallprompt event, defer it, show custom install button. Track installation via appinstalled event.
- **Display standalone**: Makes app feel native — no browser chrome. Set viewport: width=device-width, initial-scale=1, viewport-fit=cover for edge-to-edge.

### 7. Vite Code Splitting & Bundle Optimization
- **Dynamic import()**: Use for route-level splitting. `const page = lazy(() => import('./pages/[page]'))`.
- **manualChunks in rollupOptions**: Split stable vendor code into separate chunks for better caching:
  - 'vendor-solid': ['solid-js', 'solid-js/web', 'solid-js/store']
  - 'vendor-uplot': ['uplot', '@dschz/solid-uplot']
  - 'vendor-idb': ['idb']
- **Chunk analysis**: Use rollup-plugin-visualizer to inspect bundle composition. Run after every significant dependency change.
- **Tree shaking**: SolidJS compiler excels at dead code elimination. Use named imports, avoid barrel files that defeat tree shaking. Ensure sideEffects: false in package.json.
- **CSS optimization**: UnoCSS generates only used utilities — inherently optimal. No purge step needed.
- **Target budget**: SolidJS core ~7KB gzipped + uPlot ~13KB gzipped + idb ~1.2KB + app code. Total well under 50KB gzipped for initial route if properly split.

### 8. Mobile-First Responsive Design
- **Touch targets**: 44x44px minimum for all interactive elements (buttons, links, form controls). Use min-h-[44px] min-w-[44px] in UnoCSS.
- **Viewport meta**: `<meta name='viewport' content='width=device-width, initial-scale=1, viewport-fit=cover'>`
- **Safe area insets**: Use env(safe-area-inset-top) etc. for notched devices. UnoCSS: pt-[env(safe-area-inset-top)].
- **Input optimization**: Use type='number' inputmode='decimal' for weight/hydration inputs, type='search' for food search, type='date' for date pickers — triggers appropriate mobile keyboards.
- **Pull-to-refresh**: Implement via touch event listeners (touchstart/touchmove/touchend) with threshold detection. Show refresh indicator. Disable during scroll to prevent conflicts.
- **Swipe gestures**: Swipe-to-delete for log entries, swipe between date views. Use pointer events for cross-device compat.
- **Responsive breakpoints**: Design for 320px minimum width (small Android phones), scale up to tablet/desktop as progressive enhancement.
- **Font sizing**: Base 16px, use rem units. Never below 14px for readability on mobile.

### 9. Accessibility (WCAG 2.1 AA)
- **Semantic HTML first**: Use button, nav, main, article, section, h1-h6, label, fieldset/legend. No ARIA is better than bad ARIA.
- **ARIA roles/labels**: aria-label for icon-only buttons, aria-live='polite' for sync status updates, aria-expanded for collapsible sections, role='status' for toast notifications.
- **Focus management**: Manage focus on route changes (focus main content heading), trap focus in modals/dialogs, visible focus indicators (:focus-visible with 2px outline), skip-to-content link.
- **Color contrast**: 4.5:1 minimum for normal text, 3:1 for large text (18px+ bold or 24px+) and UI components. Never convey info by color alone — use icons/text alongside.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`. Respect in chart animations too.
- **Screen reader testing**: Use NVDA (free) or Android TalkBack for testing. Ensure all charts have aria-label descriptions and data tables as alternatives.
- **Form accessibility**: Every input needs visible label + aria association. Error messages linked via aria-describedby. Required fields marked with aria-required='true'.

### 10. Performance Optimization
- **Budget**: <50KB gzipped for initial load JS. SolidJS makes this achievable (7KB core vs React's 42KB).
- **Critical rendering path**: Inline critical CSS (UnoCSS can extract), defer non-critical JS, preload key routes.
- **Font loading**: Use font-display: swap, preload primary font, limit to 1-2 font families. System font stack as fallback.
- **Image optimization**: Use WebP/AVIF formats, srcset for responsive images, lazy loading for off-screen images. For PeakProtocol: minimize images — use SVG icons, CSS gradients.
- **Layout shift prevention**: Set explicit width/height on images, reserve space for charts with aspect-ratio, avoid FOUT with font preloading. Target CLS < 0.1.
- **Rendering performance**: SolidJS fine-grained reactivity means no virtual DOM diffing overhead. Avoid unnecessary createEffect chains. Use untrack() when reading signals without subscribing.

## Tools & Technologies

| Tool | Version/Variant | Purpose | Size (gzipped) |
|------|----------------|---------|----------------|
| SolidJS | 1.9+ | UI framework, reactivity | ~7KB |
| @solidjs/router | latest | Client-side routing with lazy loading | ~4KB |
| UnoCSS | latest + preset-wind3 | Atomic CSS (Tailwind-compatible) | Build-time only |
| uPlot | 1.6+ | Canvas charts (line, bar, area) | ~13KB |
| @dschz/solid-uplot | latest | SolidJS wrapper for uPlot | ~2KB |
| idb | 8+ | IndexedDB Promise wrapper | ~1.2KB |
| vite-plugin-pwa | 0.20+ | PWA build integration | Build-time only |
| workbox-background-sync | 7+ | Offline queue replay | ~3KB (SW only) |
| workbox-precaching | 7+ | Asset precaching | ~4KB (SW only) |
| workbox-routing | 7+ | Cache strategy routing | ~3KB (SW only) |
| @solid-primitives/resize-observer | latest | Reactive element sizing | ~1KB |
| @solid-primitives/connectivity | latest | Online/offline signal | <1KB |
| @solid-primitives/storage | latest | Reactive persistent storage | ~2KB |
| rollup-plugin-visualizer | latest | Bundle analysis | Dev only |
| Vite | 6+ | Build tool | Dev only |

## Domain Knowledge

- **PWA lifecycle**: Install -> Activate -> Fetch loop. Understand SW update flow (skipWaiting vs user-prompted update).
- **Offline-first architecture**: Local DB is source of truth. UI -> IndexedDB (optimistic) -> Sync Queue -> Background Sync -> Server API -> Reconciliation.
- **Canvas rendering**: uPlot uses Canvas 2D — not DOM. Understand that chart content is not accessible to screen readers without explicit ARIA descriptions.
- **Reactive programming**: Signals are the atoms. Effects are the consumers. Memos are cached derivations. Stores are nested signal trees. Understand the dependency graph.
- **Bundle economics**: Every KB costs ~10ms on 3G. 50KB budget = ~500ms parse time on slow mobile. Code split aggressively, lazy load non-critical routes.
- **Single-user context**: PeakProtocol is single-user, which simplifies conflict resolution (no multi-user merge needed). LWW is sufficient. No CRDT complexity required.

## Best Practices

1. **Signal discipline**: Keep signals granular. One signal per datum, not one signal for the whole form. SolidJS optimizes fine-grained updates.
2. **Component boundaries**: Components in SolidJS only run once (no re-rendering). Put reactive logic in effects/memos, not component body flow.
3. **Offline-first by default**: Never assume network. Every user action must work offline and sync later. Test with DevTools network offline mode.
4. **Progressive enhancement**: Core features work on 320px screen with slow connection. Enhanced features (charts, animations) load progressively.
5. **Accessibility from day one**: Don't bolt it on later. Semantic HTML + ARIA from the first component. Test with keyboard-only navigation.
6. **Performance budgets**: Set up size-limit or bundlesize CI checks. Alert if any chunk exceeds 15KB gzipped.
7. **Mobile-first CSS**: Write base styles for mobile, add complexity with breakpoint prefixes. Never the reverse.
8. **Cache versioning**: Use content hashes in filenames (Vite default). Precache manifest auto-updates on new builds.

## Common Pitfalls

1. **Destructuring props breaks reactivity**: `const { name } = props` loses reactivity. Always use props.name or mergeProps/splitProps.
2. **Accessing signals outside reactive context**: Reading a signal in a setTimeout or Promise .then() won't track. Use untrack() intentionally or restructure.
3. **Over-using createEffect**: Effects should be for side effects (DOM, network, storage), not derived state. Use createMemo for computed values.
4. **IndexedDB transactions auto-closing**: Transactions close after a microtask. Don't await between IndexedDB operations within a transaction — batch them.
5. **Service Worker scope issues**: SW at /sw.js scopes to /. If placed in subdirectory, it only controls that subtree. Ensure SW is at root.
6. **Canvas charts + accessibility**: uPlot renders to Canvas — invisible to screen readers. Must provide alternative text descriptions and optional data tables.
7. **Maskable icon safe zone**: Design icons within the inner 80% circle. Content at edges will be clipped on some devices.
8. **Touch target overlap**: On mobile, elements closer than 8px can cause mis-taps. Ensure adequate spacing between interactive elements.
9. **Background sync timing**: Background sync fires when the browser thinks connectivity is restored — may be delayed. Don't promise immediate sync to users.
10. **UnoCSS dynamic classes**: Classes constructed with template literals won't be detected by the extractor. Use safelist or explicit class maps.

## Quality Criteria

1. **Lighthouse PWA score > 90**: All PWA audits pass, performance score > 90 on mobile throttling.
2. **Bundle size < 50KB gzipped**: Initial route JS payload under 50KB. Verified with rollup-plugin-visualizer.
3. **Offline functionality**: All CRUD operations work without network. Sync completes correctly when connectivity restored.
4. **WCAG 2.1 AA compliance**: All interactive elements keyboard accessible, color contrast passes, screen reader navigable.
5. **Mobile-first responsive**: Usable at 320px width. Touch targets >= 44px. No horizontal scroll on any supported viewport.
6. **Chart performance**: uPlot renders 1000+ data points at 60fps on mid-range Android device.
7. **Zero layout shift**: CLS < 0.1 on all pages. Charts and async content have reserved space.

## Recommended Prompt Elements

1. "You are Pixel, the Frontend UI/UX Specialist for PeakProtocol. You own all user-facing interface code."
2. "You write SolidJS components using fine-grained reactivity: createSignal for primitives, createStore for nested state, createResource for async data, createMemo for derived values."
3. "You NEVER destructure props. You always access props.fieldName to preserve reactivity."
4. "You style with UnoCSS (Wind3/Tailwind preset). You write mobile-first: base styles for 320px, then sm:/md:/lg: for larger screens."
5. "Every interactive element must be at least 44x44px for touch targets."
6. "You use uPlot via @dschz/solid-uplot for all charts. Charts must be responsive (resize with container) and have aria-label descriptions."
7. "You implement offline-first: write to IndexedDB first (via idb library), queue mutations for background sync, show sync status to user."
8. "Your PWA uses vite-plugin-pwa with InjectManifest strategy. You configure CacheFirst for assets, NetworkFirst for API calls."
9. "Your total initial JS payload must stay under 50KB gzipped. You use lazy() for route-level code splitting and manualChunks for vendor splitting."
10. "You follow WCAG 2.1 AA: semantic HTML, ARIA labels on icon buttons, 4.5:1 contrast ratio, visible focus indicators, prefers-reduced-motion support."
11. "You CANNOT modify: database schemas, backend API endpoints, CI/CD configuration. You CAN modify: .tsx/.ts files, CSS, Vite config, service worker, manifest, IndexedDB schemas."
12. "Before completing any component, verify: works at 320px width, keyboard navigable, no layout shift, offline-capable, within bundle budget."
