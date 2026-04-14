import { openDB, type IDBPDatabase } from "idb";

export interface QueuedMutation {
  id?: number;
  entityType: string;
  entityId: string;
  operation: "create" | "update" | "delete";
  url: string;
  method: string;
  body: string | null;
  timestamp: number;
  retryCount: number;
  status: "pending" | "syncing" | "failed";
}

const DB_NAME = "peakprotocol-offline";
const STORE_NAME = "syncQueue";
const DB_VERSION = 1;
const MAX_RETRIES = 3;

let dbPromise: Promise<IDBPDatabase> | null = null;

export async function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by-status-timestamp", ["status", "timestamp"]);
      },
    });
  }
  return dbPromise;
}

export async function queueMutation(
  mutation: Omit<QueuedMutation, "id" | "retryCount" | "status">,
): Promise<void> {
  const db = await getDb();
  await db.add(STORE_NAME, {
    ...mutation,
    retryCount: 0,
    status: "pending",
  });
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await getDb();
  const index = db.transaction(STORE_NAME, "readonly").store.index("by-status-timestamp");
  return (await index.getAll(IDBKeyRange.bound(
    ["pending", 0],
    ["pending", Number.MAX_SAFE_INTEGER],
  ))) as QueuedMutation[];
}

export async function replayMutations(): Promise<{ success: number; failed: number }> {
  const pending = await getPendingMutations();
  let success = 0;
  let failed = 0;

  for (const mutation of pending) {
    const db = await getDb();

    // Mark as syncing
    await db.put(STORE_NAME, { ...mutation, status: "syncing" });

    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.body ? { "Content-Type": "application/json" } : undefined,
        body: mutation.body,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Success — remove from queue
      await db.delete(STORE_NAME, mutation.id!);
      success++;
    } catch {
      const retryCount = mutation.retryCount + 1;
      const status = retryCount >= MAX_RETRIES ? "failed" : "pending";
      await db.put(STORE_NAME, { ...mutation, retryCount, status });
      failed++;
    }
  }

  return { success, failed };
}

export async function getQueueCount(): Promise<number> {
  const db = await getDb();
  const index = db.transaction(STORE_NAME, "readonly").store.index("by-status-timestamp");
  return index.count(IDBKeyRange.bound(
    ["pending", 0],
    ["pending", Number.MAX_SAFE_INTEGER],
  ));
}

export async function clearFailed(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const index = tx.store.index("by-status-timestamp");
  let cursor = await index.openCursor(IDBKeyRange.bound(
    ["failed", 0],
    ["failed", Number.MAX_SAFE_INTEGER],
  ));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
