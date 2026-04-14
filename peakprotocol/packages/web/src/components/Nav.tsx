/**
 * Bottom navigation bar for PeakProtocol (WRK-016).
 *
 * Mobile-first bottom nav with links to Dashboard and Supplements.
 * On md+ screens it becomes a compact sidebar.
 */
import { A, useLocation } from "@solidjs/router";

export default function Nav() {
  const location = useLocation();

  const isActive = (path: string): boolean => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Bottom nav — mobile */}
      <nav class="fixed bottom-0 left-0 right-0 z-50 flex md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <A
          href="/"
          class={`touch-target flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
            isActive("/")
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <svg class="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
          </svg>
          Dashboard
        </A>
        <A
          href="/supplements"
          class={`touch-target flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
            isActive("/supplements")
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <svg class="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          Supplements
        </A>
        <A
          href="/metrics"
          class={`touch-target flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
            isActive("/metrics")
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <svg class="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13h2v8H3zm6-4h2v12H9zm6-6h2v18h-2zm6 10h2v8h-2z" />
          </svg>
          Metrics
        </A>
        <A
          href="/food"
          class={`touch-target flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
            isActive("/food")
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <svg class="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 6c0 3.31 2.69 6 6 6s6-2.69 6-6H6zm6-12C8.96 2 5.47 4.02 3.87 7.15l1.93.88A8.004 8.004 0 0112 4c2.83 0 5.3 1.47 6.73 3.69l1.79-1.07A10.003 10.003 0 0012 2z" />
          </svg>
          Food
        </A>
        <A
          href="/training"
          class={`touch-target flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
            isActive("/training")
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <svg class="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l3-9 4 18 3-9h4" />
          </svg>
          Training
        </A>
        <A
          href="/journal"
          class={`touch-target flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
            isActive("/journal")
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <svg class="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          Journal
        </A>
        <A
          href="/reports"
          class={`touch-target flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
            isActive("/reports")
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <svg class="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Reports
        </A>
      </nav>

      {/* Sidebar — md+ */}
      <aside class="hidden md:flex fixed top-0 left-0 bottom-0 z-50 w-56 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div class="p-4">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">PeakProtocol</h2>
        </div>
        <nav class="flex-1 px-2 space-y-1">
          <A
            href="/"
            class={`touch-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/")
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
            </svg>
            Dashboard
          </A>
          <A
            href="/supplements"
            class={`touch-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/supplements")
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            Supplements
          </A>
          <A
            href="/metrics"
            class={`touch-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/metrics")
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 13h2v8H3zm6-4h2v12H9zm6-6h2v18h-2zm6 10h2v8h-2z" />
            </svg>
            Metrics
          </A>
          <A
            href="/food"
            class={`touch-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/food")
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 6c0 3.31 2.69 6 6 6s6-2.69 6-6H6zm6-12C8.96 2 5.47 4.02 3.87 7.15l1.93.88A8.004 8.004 0 0112 4c2.83 0 5.3 1.47 6.73 3.69l1.79-1.07A10.003 10.003 0 0012 2z" />
            </svg>
            Food
          </A>
          <A
            href="/training"
            class={`touch-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/training")
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l3-9 4 18 3-9h4" />
            </svg>
            Training
          </A>
          <A
            href="/journal"
            class={`touch-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/journal")
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Journal
          </A>
          <A
            href="/reports"
            class={`touch-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/reports")
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Reports
          </A>
        </nav>
      </aside>
    </>
  );
}
