/**
 * API integration tests for journal entries and search.
 * Covers EVL-12: Journal search returns in <500ms.
 *
 * Requires a running dev server: cd peakprotocol/packages/api && npx wrangler dev --local
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TestClient } from "../helpers/api-client";
import { createTestJournalEntry, createJournalSearchData } from "../helpers/fixtures";

const client = new TestClient();

beforeAll(async () => {
  await client.getDeviceToken();
});

// ── Journal CRUD ────────────────────────────────────────────────────

describe("Journal Entry CRUD", () => {
  let entryId: string;

  it("creates a journal entry with tags", async () => {
    const entry = await client.createJournalEntry(
      createTestJournalEntry({
        date: "2026-04-01",
        content: "Eval test journal entry.",
        tags: ["test", "energy"],
      }),
    );

    expect(entry.id).toBeTruthy();
    expect(entry.content).toBe("Eval test journal entry.");
    expect(entry.tags).toContain("test");
    expect(entry.tags).toContain("energy");

    entryId = entry.id;
  });

  it("lists journal entries by tag", async () => {
    const entries = await client.listJournalEntries({ tag: "test" });

    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.some((e) => e.id === entryId)).toBe(true);
  });
});

// ── EVL-12: Journal Search Performance ──────────────────────────────

describe("EVL-12: Journal Search Performance", () => {
  beforeAll(async () => {
    // Seed 10 journal entries with various tags
    const entries = createJournalSearchData();
    for (const entry of entries) {
      await client.createJournalEntry(entry);
    }
  });

  it("search by tag 'energy' returns correct results", async () => {
    const { entries, total } = await client.searchJournal("energy");

    // At least 3 entries should match "energy" (from seeded data)
    expect(
      entries.length,
      "Search for 'energy' should return at least 3 entries from seeded data",
    ).toBeGreaterThanOrEqual(3);
    expect(total).toBeGreaterThanOrEqual(3);
  });

  it("search returns results within 500ms", async () => {
    const start = performance.now();
    await client.searchJournal("energy");
    const elapsed = performance.now() - start;

    expect(
      elapsed,
      `Journal search took ${Math.round(elapsed)}ms, expected < 500ms`,
    ).toBeLessThan(500);
  });

  it("search for non-existent term returns empty results", async () => {
    const { entries, total } = await client.searchJournal("xyznonexistent123");

    expect(entries).toHaveLength(0);
    expect(total).toBe(0);
  });
});
