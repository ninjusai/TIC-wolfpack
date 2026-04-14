/**
 * KV-backed session management for PeakProtocol.
 *
 * Key format : "session:{token}"
 * Value      : JSON-encoded SessionData
 * TTL        : 30 days (2 592 000 s)
 * Metadata   : { userId, expiresAt } for efficient list/filter
 *
 * KV is eventually consistent (~60 s propagation) — acceptable for sessions.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface SessionData {
  userId: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  lastAccessedAt: string;
  deviceInfo?: string;
}

export interface SessionMetadata {
  userId: string;
  /** Unix timestamp (seconds) */
  expiresAt: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const SESSION_PREFIX = "session:";
/** 30 days in seconds */
const SESSION_TTL = 2_592_000;
/** Sliding-window refresh threshold: 1 day in milliseconds */
const REFRESH_THRESHOLD_MS = 86_400_000;

// ── Helpers ────────────────────────────────────────────────────────────

function sessionKey(token: string): string {
  return `${SESSION_PREFIX}${token}`;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random session token.
 *
 * Uses `crypto.randomUUID()` which is available in the Workers runtime.
 */
export function generateToken(): string {
  return crypto.randomUUID();
}

/**
 * Create a new session and store it in KV.
 *
 * @returns The generated session token.
 */
export async function createSession(
  kv: KVNamespace,
  data: Omit<SessionData, "createdAt" | "lastAccessedAt"> & {
    deviceInfo?: string;
  }
): Promise<string> {
  const token = generateToken();
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL;

  const sessionData: SessionData = {
    userId: data.userId,
    createdAt: now,
    lastAccessedAt: now,
    ...(data.deviceInfo ? { deviceInfo: data.deviceInfo } : {}),
  };

  const metadata: SessionMetadata = {
    userId: data.userId,
    expiresAt,
  };

  await kv.put(sessionKey(token), JSON.stringify(sessionData), {
    expirationTtl: SESSION_TTL,
    metadata,
  });

  return token;
}

/**
 * Validate and retrieve a session from KV.
 *
 * Implements sliding-window refresh: if the session's `lastAccessedAt` is
 * older than 1 day the timestamp is updated and the value is re-written
 * with a fresh 30-day TTL.
 *
 * @returns The session data, or `null` if not found / expired.
 */
export async function getSession(
  kv: KVNamespace,
  token: string
): Promise<SessionData | null> {
  const raw = await kv.get(sessionKey(token), "text");
  if (raw === null) return null;

  const session: SessionData = JSON.parse(raw);

  // Sliding-window: refresh if older than 1 day
  const lastAccessed = new Date(session.lastAccessedAt).getTime();
  if (Date.now() - lastAccessed > REFRESH_THRESHOLD_MS) {
    const now = new Date().toISOString();
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL;

    const updated: SessionData = { ...session, lastAccessedAt: now };
    const metadata: SessionMetadata = { userId: session.userId, expiresAt };

    await kv.put(sessionKey(token), JSON.stringify(updated), {
      expirationTtl: SESSION_TTL,
      metadata,
    });

    return updated;
  }

  return session;
}

/**
 * Destroy a session by deleting its KV key.
 */
export async function deleteSession(
  kv: KVNamespace,
  token: string
): Promise<void> {
  await kv.delete(sessionKey(token));
}
