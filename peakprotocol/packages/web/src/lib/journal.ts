/**
 * Journal API types and helpers (WRK-036).
 */
import { apiFetch } from "./api";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* API calls                                                          */
/* ------------------------------------------------------------------ */

export async function getJournalEntries(date: string): Promise<JournalEntry[]> {
  const res = await apiFetch<{ entries: JournalEntry[] }>(
    `/api/journal?date=${encodeURIComponent(date)}`,
  );
  return res.entries;
}

export async function createJournalEntry(data: {
  date: string;
  content: string;
  tags?: string[];
}): Promise<JournalEntry> {
  const res = await apiFetch<{ entry: JournalEntry }>("/api/journal", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.entry;
}

export async function updateJournalEntry(
  id: string,
  data: Partial<{ content: string; tags: string[] }>,
): Promise<JournalEntry> {
  const res = await apiFetch<{ entry: JournalEntry }>(`/api/journal/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.entry;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await apiFetch<{ success: true }>(`/api/journal/${id}`, {
    method: "DELETE",
  });
}

export async function searchJournal(
  query: string,
  limit?: number,
): Promise<{ entries: JournalEntry[]; total: number }> {
  const params = new URLSearchParams({ q: query });
  if (limit != null) params.set("limit", String(limit));
  return apiFetch<{ entries: JournalEntry[]; total: number }>(
    `/api/journal/search?${params.toString()}`,
  );
}
