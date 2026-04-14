/**
 * Journal page (WRK-036).
 *
 * Daily journaling with search, date navigation, tagging, inline editing.
 * Mobile-first with notebook-style writing area.
 */
import {
  createSignal,
  createResource,
  createEffect,
  Show,
  For,
  on,
  type Component,
} from "solid-js";
import { formatDate, shiftDate } from "../lib/metrics";
import {
  getJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  searchJournal,
  type JournalEntry,
} from "../lib/journal";

/* ------------------------------------------------------------------ */
/* Tag color palette                                                  */
/* ------------------------------------------------------------------ */

const TAG_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
];

function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const Journal: Component = () => {
  /* ---- Tab state ---- */
  const [activeTab, setActiveTab] = createSignal<"journal" | "search">("journal");

  /* ---- Date navigation ---- */
  const [selectedDate, setSelectedDate] = createSignal(formatDate(new Date()));
  const isToday = () => selectedDate() === formatDate(new Date());

  const goBack = () => setSelectedDate(shiftDate(selectedDate(), -1));
  const goForward = () => setSelectedDate(shiftDate(selectedDate(), 1));
  const goToday = () => setSelectedDate(formatDate(new Date()));

  /* ---- Fetch entries for selected date ---- */
  const [entries, { refetch }] = createResource(selectedDate, (date) =>
    getJournalEntries(date),
  );

  /* ---- New entry form state ---- */
  const [content, setContent] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [tagInput, setTagInput] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal("");

  const handleAddTag = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput().trim().replace(/,$/g, "");
      if (val && !tags().includes(val)) {
        setTags([...tags(), val]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags().filter((t) => t !== tag));
  };

  const saveEntry = async () => {
    const c = content().trim();
    if (!c) return;
    setSaving(true);
    setSaveError("");
    try {
      await createJournalEntry({
        date: selectedDate(),
        content: c,
        tags: tags().length > 0 ? tags() : undefined,
      });
      setContent("");
      setTags([]);
      setTagInput("");
      refetch();
    } catch {
      setSaveError("Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  /* ---- Auto-expand textarea ---- */
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  /* ---- Edit mode ---- */
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editContent, setEditContent] = createSignal("");
  const [editTags, setEditTags] = createSignal<string[]>([]);
  const [editTagInput, setEditTagInput] = createSignal("");
  const [savingEdit, setSavingEdit] = createSignal(false);

  const startEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setEditContent(entry.content);
    setEditTags([...entry.tags]);
    setEditTagInput("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
    setEditTags([]);
    setEditTagInput("");
  };

  const handleEditAddTag = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = editTagInput().trim().replace(/,$/g, "");
      if (val && !editTags().includes(val)) {
        setEditTags([...editTags(), val]);
      }
      setEditTagInput("");
    }
  };

  const removeEditTag = (tag: string) => {
    setEditTags(editTags().filter((t) => t !== tag));
  };

  const saveEdit = async () => {
    const id = editingId();
    if (!id) return;
    setSavingEdit(true);
    try {
      await updateJournalEntry(id, {
        content: editContent(),
        tags: editTags(),
      });
      cancelEdit();
      refetch();
    } catch {
      // silent
    } finally {
      setSavingEdit(false);
    }
  };

  /* ---- Delete ---- */
  const [confirmDeleteId, setConfirmDeleteId] = createSignal<string | null>(null);
  const [deletingId, setDeletingId] = createSignal<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteJournalEntry(id);
      setConfirmDeleteId(null);
      refetch();
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  /* ---- Search ---- */
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<JournalEntry[]>([]);
  const [searchTotal, setSearchTotal] = createSignal(0);
  const [searching, setSearching] = createSignal(false);

  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(
    on(
      () => searchQuery(),
      (q) => {
        if (searchTimer) clearTimeout(searchTimer);
        if (!q.trim()) {
          setSearchResults([]);
          setSearchTotal(0);
          return;
        }
        setSearching(true);
        searchTimer = setTimeout(async () => {
          try {
            const res = await searchJournal(q.trim(), 20);
            setSearchResults(res.entries);
            setSearchTotal(res.total);
          } catch {
            setSearchResults([]);
            setSearchTotal(0);
          } finally {
            setSearching(false);
          }
        }, 300);
      },
    ),
  );

  const navigateToDate = (date: string) => {
    setSelectedDate(date);
    setActiveTab("journal");
    setSearchQuery("");
    setSearchResults([]);
  };

  /* ---- Helpers ---- */
  const dateLabel = () => {
    if (isToday()) return "Today";
    const d = new Date(selectedDate() + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const truncate = (text: string, len: number) =>
    text.length > len ? text.slice(0, len) + "..." : text;

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div class="pb-24 md:pb-8 md:ml-56">
      <div class="max-w-3xl mx-auto px-4 py-6">
        {/* ---- Tabs ---- */}
        <div class="flex gap-1 mb-5 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
          <button
            class={`touch-target flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab() === "journal"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("journal")}
          >
            Journal
          </button>
          <button
            class={`touch-target flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab() === "search"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("search")}
          >
            Search
          </button>
        </div>

        {/* ============================================================ */}
        {/* JOURNAL TAB                                                  */}
        {/* ============================================================ */}
        <Show when={activeTab() === "journal"}>
          {/* ---- Date Navigation ---- */}
          <div class="flex items-center justify-between mb-6">
            <button
              class="touch-target p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={goBack}
              aria-label="Previous day"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div class="flex items-center gap-3">
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">
                {dateLabel()}
              </h1>
              <input
                type="date"
                value={selectedDate()}
                onInput={(e) => setSelectedDate(e.currentTarget.value)}
                class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              />
              <Show when={!isToday()}>
                <button
                  class="touch-target text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={goToday}
                >
                  Today
                </button>
              </Show>
            </div>

            <button
              class="touch-target p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={goForward}
              aria-label="Next day"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* ---- New Entry ---- */}
          <section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-5">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              New Entry
            </h2>

            <textarea
              placeholder="What's on your mind?"
              value={content()}
              onInput={(e) => {
                setContent(e.currentTarget.value);
                autoResize(e.currentTarget);
              }}
              rows={3}
              class="touch-target w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base leading-relaxed bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              style={{ "min-height": "5rem" }}
            />

            {/* Tags */}
            <div class="mt-3">
              <div class="flex flex-wrap gap-1.5 mb-2">
                <For each={tags()}>
                  {(tag) => (
                    <span
                      class={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tagColor(tag)}`}
                    >
                      {tag}
                      <button
                        type="button"
                        class="hover:opacity-60 transition-opacity"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                      >
                        x
                      </button>
                    </span>
                  )}
                </For>
              </div>
              <input
                type="text"
                placeholder="Add tags (Enter or comma)"
                value={tagInput()}
                onInput={(e) => setTagInput(e.currentTarget.value)}
                onKeyDown={handleAddTag}
                class="touch-target w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <Show when={saveError()}>
              <p class="text-sm text-red-600 dark:text-red-400 mt-2">{saveError()}</p>
            </Show>

            <div class="mt-3">
              <button
                class="touch-target px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                onClick={saveEntry}
                disabled={saving() || !content().trim()}
              >
                {saving() ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </section>

          {/* ---- Loading state ---- */}
          <Show when={entries.loading}>
            <div class="space-y-4">
              <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-3" />
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          </Show>

          {/* ---- Today's Entries ---- */}
          <Show when={!entries.loading}>
            <Show
              when={(entries() ?? []).length > 0}
              fallback={
                <div class="text-center py-12">
                  <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                  <p class="text-gray-500 dark:text-gray-400">
                    No entries for this date. Start writing above.
                  </p>
                </div>
              }
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Entries
              </h2>
              <div class="space-y-4">
                <For each={entries()}>
                  {(entry) => (
                    <section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                      <Show
                        when={editingId() === entry.id}
                        fallback={
                          <>
                            {/* Content */}
                            <p class="text-base text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                              {entry.content}
                            </p>

                            {/* Tags */}
                            <Show when={entry.tags.length > 0}>
                              <div class="flex flex-wrap gap-1.5 mt-3">
                                <For each={entry.tags}>
                                  {(tag) => (
                                    <span
                                      class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tagColor(tag)}`}
                                    >
                                      {tag}
                                    </span>
                                  )}
                                </For>
                              </div>
                            </Show>

                            {/* Footer */}
                            <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                              <span class="text-xs text-gray-400 dark:text-gray-500">
                                {formatTime(entry.createdAt)}
                                <Show when={entry.updatedAt !== entry.createdAt}>
                                  {" "}(edited)
                                </Show>
                              </span>

                              <div class="flex items-center gap-2">
                                <button
                                  class="touch-target p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  onClick={() => startEdit(entry)}
                                  aria-label="Edit entry"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                  </svg>
                                </button>

                                <Show
                                  when={confirmDeleteId() === entry.id}
                                  fallback={
                                    <button
                                      class="touch-target p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                      onClick={() => setConfirmDeleteId(entry.id)}
                                      aria-label="Delete entry"
                                    >
                                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  }
                                >
                                  <div class="flex items-center gap-1">
                                    <button
                                      class="touch-target px-2.5 py-1 rounded text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                                      onClick={() => handleDelete(entry.id)}
                                      disabled={deletingId() === entry.id}
                                    >
                                      {deletingId() === entry.id ? "..." : "Delete"}
                                    </button>
                                    <button
                                      class="touch-target px-2.5 py-1 rounded text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                      onClick={() => setConfirmDeleteId(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </Show>
                              </div>
                            </div>
                          </>
                        }
                      >
                        {/* ---- Inline edit mode ---- */}
                        <textarea
                          value={editContent()}
                          onInput={(e) => {
                            setEditContent(e.currentTarget.value);
                            autoResize(e.currentTarget);
                          }}
                          rows={3}
                          class="touch-target w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base leading-relaxed bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                          style={{ "min-height": "5rem" }}
                        />

                        {/* Edit tags */}
                        <div class="mt-3">
                          <div class="flex flex-wrap gap-1.5 mb-2">
                            <For each={editTags()}>
                              {(tag) => (
                                <span
                                  class={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tagColor(tag)}`}
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    class="hover:opacity-60 transition-opacity"
                                    onClick={() => removeEditTag(tag)}
                                    aria-label={`Remove tag ${tag}`}
                                  >
                                    x
                                  </button>
                                </span>
                              )}
                            </For>
                          </div>
                          <input
                            type="text"
                            placeholder="Add tags (Enter or comma)"
                            value={editTagInput()}
                            onInput={(e) => setEditTagInput(e.currentTarget.value)}
                            onKeyDown={handleEditAddTag}
                            class="touch-target w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>

                        <div class="flex items-center gap-2 mt-3">
                          <button
                            class="touch-target px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                            onClick={saveEdit}
                            disabled={savingEdit()}
                          >
                            {savingEdit() ? "Saving..." : "Save"}
                          </button>
                          <button
                            class="touch-target px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </Show>
                    </section>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Show>

        {/* ============================================================ */}
        {/* SEARCH TAB                                                   */}
        {/* ============================================================ */}
        <Show when={activeTab() === "search"}>
          <div class="mb-5">
            <div class="relative">
              <svg
                class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search journal entries..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="touch-target w-full border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Search loading */}
          <Show when={searching()}>
            <div class="space-y-3">
              <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              </div>
              <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              </div>
            </div>
          </Show>

          {/* Search results */}
          <Show when={!searching()}>
            <Show when={searchQuery().trim() && searchResults().length === 0}>
              <div class="text-center py-12">
                <p class="text-gray-500 dark:text-gray-400">
                  No entries found for "{searchQuery()}"
                </p>
              </div>
            </Show>

            <Show when={searchResults().length > 0}>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {searchTotal()} result{searchTotal() !== 1 ? "s" : ""} found
              </p>
              <div class="space-y-3">
                <For each={searchResults()}>
                  {(entry) => (
                    <button
                      class="touch-target w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                      onClick={() => navigateToDate(entry.date)}
                    >
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded px-2 py-0.5">
                          {entry.date}
                        </span>
                        <span class="text-xs text-gray-400 dark:text-gray-500">
                          {formatTime(entry.createdAt)}
                        </span>
                      </div>
                      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {truncate(entry.content, 150)}
                      </p>
                      <Show when={entry.tags.length > 0}>
                        <div class="flex flex-wrap gap-1 mt-2">
                          <For each={entry.tags}>
                            {(tag) => (
                              <span
                                class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(tag)}`}
                              >
                                {tag}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <Show when={!searchQuery().trim()}>
              <div class="text-center py-12">
                <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <p class="text-gray-500 dark:text-gray-400">
                  Search across all your journal entries
                </p>
              </div>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default Journal;
