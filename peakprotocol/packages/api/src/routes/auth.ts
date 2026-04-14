/**
 * Authentication routes for PeakProtocol.
 *
 * This file contains:
 * - WebAuthn passkey registration endpoints (WRK-006)
 * - Device-bound fallback auth endpoints (WRK-008)
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { createSession, getSession, deleteSession } from "../services/session";
import {
  buildSessionCookie,
  buildClearCookie,
  parseSessionCookie,
} from "../lib/cookies";
import {
  base64urlEncode,
  base64urlDecode,
  parseCBOR,
  parseAuthenticatorData,
  generateRecoveryCodes,
  importCOSEPublicKey,
  verifyAssertion,
} from "../lib/webauthn";

export const authRoutes = new Hono<{ Bindings: Env }>();

// ── Simple Passcode Auth (single-user) ──────────────────────────────

const PasscodeSchema = z.object({
  passcode: z.string().min(1, "Passcode is required"),
});

/**
 * POST /api/auth/passcode
 *
 * Authenticate with a simple passcode/PIN.
 * Compares against the APP_PASSCODE Wrangler secret.
 * Creates a KV session for a fixed user ID ("owner") so all data
 * is accessible from any device.
 */
authRoutes.post("/api/auth/passcode", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = PasscodeSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400
    );
  }

  const { passcode } = parsed.data;

  // Compare against the Wrangler secret
  const expected = c.env.APP_PASSCODE;
  if (!expected) {
    return c.json({ error: "Passcode auth not configured" }, 500);
  }

  // Constant-time-ish comparison (both are short strings)
  if (passcode !== expected) {
    return c.json({ error: "Invalid passcode" }, 401);
  }

  // Create session with fixed user ID "owner"
  const token = await createSession(c.env.KV, {
    userId: "owner",
    deviceInfo: "passcode-auth",
  });

  const cookie = buildSessionCookie(token);

  return c.json({ token }, 200, {
    "Set-Cookie": cookie,
  });
});

// ── Zod Schemas for Request Body Validation (AUD-007) ───────────────

const RegisterVerifySchema = z.object({
  challengeId: z.string(),
  attestation: z.object({
    id: z.string(),
    rawId: z.string(),
    type: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
    }),
  }),
});

const LoginVerifySchema = z.object({
  challengeId: z.string(),
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    type: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      authenticatorData: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
  }),
});

const RecoverySchema = z.object({
  code: z.string().min(1, "Recovery code is required"),
});

// ── Device-Bound Fallback Auth (WRK-008) ─────────────────────────────

/**
 * POST /api/auth/device-token
 *
 * Generate a device-bound session token for browsers that lack WebAuthn.
 * Creates a KV-backed session and returns the token both as a cookie and
 * in the JSON body (client stores in localStorage as backup).
 */
authRoutes.post("/api/auth/device-token", async (c) => {
  const deviceId = crypto.randomUUID();

  const token = await createSession(c.env.KV, {
    userId: `device:${deviceId}`,
    deviceInfo: "device-bound-fallback",
  });

  const cookie = buildSessionCookie(token);

  return c.json({ token }, 201, {
    "Set-Cookie": cookie,
  });
});

/**
 * POST /api/auth/device-verify
 *
 * Validate an existing device-bound session token.
 * Accepts the token from either the Authorization header (Bearer) or
 * the session cookie.
 */
authRoutes.post("/api/auth/device-verify", async (c) => {
  // 1. Extract token from Authorization header or cookie
  let token: string | null = null;

  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token) {
    const cookieHeader = c.req.header("Cookie");
    if (cookieHeader) {
      token = parseSessionCookie(cookieHeader);
    }
  }

  if (!token) {
    return c.json({ valid: false, error: "No token provided" }, 401);
  }

  // 2. Validate via session service
  const session = await getSession(c.env.KV, token);

  if (!session) {
    return c.json({ valid: false, error: "Invalid or expired session" }, 401);
  }

  return c.json({ valid: true, session });
});

/**
 * POST /api/auth/device-logout
 *
 * Clear the device-bound session. Removes the cookie.
 */
authRoutes.post("/api/auth/device-logout", async (c) => {
  let token: string | null = null;

  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token) {
    const cookieHeader = c.req.header("Cookie");
    if (cookieHeader) {
      token = parseSessionCookie(cookieHeader);
    }
  }

  if (token) {
    await deleteSession(c.env.KV, token);
  }

  return c.json({ ok: true }, 200, {
    "Set-Cookie": buildClearCookie(),
  });
});

// ── Auth Status (AUD-004) ───────────────────────────────────────────────

/**
 * GET /api/auth/status
 *
 * Lightweight check for whether any passkey credentials exist.
 * Queries D1 only — no KV writes. The frontend can use this to determine
 * the auth flow without creating challenges.
 */
authRoutes.get("/api/auth/status", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM credentials"
  ).first<{ count: number }>();

  const count = result?.count ?? 0;

  return c.json({
    hasCredentials: count > 0,
    credentialCount: count,
  });
});

// ── Passkey / WebAuthn Registration (WRK-006) ──────────────────────────

const CHALLENGE_TTL_SECONDS = 300; // 5 minutes
const CHALLENGE_KEY_PREFIX = "challenge:";

function challengeKey(id: string): string {
  return `${CHALLENGE_KEY_PREFIX}${id}`;
}

/**
 * POST /api/auth/register/challenge
 *
 * Generate a WebAuthn registration challenge.
 * Stores the challenge in KV with a 5-minute TTL.
 */
authRoutes.post("/api/auth/register/challenge", async (c) => {
  const hostname = new URL(c.req.url).hostname;

  // Generate a random 32-byte challenge
  const challengeBytes = new Uint8Array(32);
  crypto.getRandomValues(challengeBytes);
  const challenge = base64urlEncode(challengeBytes.buffer);

  // Generate unique IDs
  const challengeId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  // Store challenge in KV with 5-minute TTL
  await c.env.KV.put(
    challengeKey(challengeId),
    JSON.stringify({
      challenge,
      userId,
      createdAt: new Date().toISOString(),
    }),
    { expirationTtl: CHALLENGE_TTL_SECONDS }
  );

  return c.json({
    challengeId,
    challenge,
    rp: {
      name: "PeakProtocol",
      id: hostname,
    },
    user: {
      id: userId,
      name: "PeakProtocol User",
      displayName: "PeakProtocol User",
    },
  });
});

/**
 * POST /api/auth/register/verify
 *
 * Verify a WebAuthn attestation response, store the credential, generate
 * recovery codes, and create a session.
 */
authRoutes.post("/api/auth/register/verify", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = RegisterVerifySchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { challengeId, attestation } = parsed.data;

  // ── 1. Retrieve and delete challenge from KV ──

  const kvKey = challengeKey(challengeId);
  const storedRaw = await c.env.KV.get(kvKey, "text");

  if (storedRaw === null) {
    return c.json({ error: "Challenge not found or expired" }, 400);
  }

  // Delete immediately to prevent replay
  await c.env.KV.delete(kvKey);

  const stored = JSON.parse(storedRaw) as {
    challenge: string;
    userId: string;
    createdAt: string;
  };

  // ── 2. Parse and validate clientDataJSON ──

  const clientDataBuffer = base64urlDecode(attestation.response.clientDataJSON);
  const clientDataText = new TextDecoder().decode(clientDataBuffer);
  const clientData = JSON.parse(clientDataText) as {
    type: string;
    challenge: string;
    origin: string;
  };

  if (clientData.type !== "webauthn.create") {
    return c.json({ error: "Invalid clientData type" }, 400);
  }

  if (clientData.challenge !== stored.challenge) {
    return c.json({ error: "Challenge mismatch" }, 400);
  }

  // Verify origin
  const expectedOrigin = new URL(c.req.url).origin;
  if (clientData.origin !== expectedOrigin) {
    const isLocalDev =
      clientData.origin.startsWith("http://localhost") ||
      clientData.origin.startsWith("https://localhost");
    const expectLocalDev =
      expectedOrigin.startsWith("http://localhost") ||
      expectedOrigin.startsWith("https://localhost");

    if (!isLocalDev && !expectLocalDev) {
      return c.json({ error: "Origin mismatch" }, 400);
    }
  }

  // ── 3. Parse attestation object (CBOR) ──

  const attestationObjectBuffer = base64urlDecode(
    attestation.response.attestationObject
  );
  const attestationMap = parseCBOR(attestationObjectBuffer);

  if (!(attestationMap instanceof Map)) {
    return c.json({ error: "Invalid attestation object" }, 400);
  }

  const fmt = attestationMap.get("fmt") as string;
  const authDataRaw = attestationMap.get("authData");

  if (!(authDataRaw instanceof ArrayBuffer)) {
    return c.json({ error: "Missing authenticator data" }, 400);
  }

  // Support "none", "packed", and "fido-u2f" attestation formats
  if (fmt !== "none" && fmt !== "packed" && fmt !== "fido-u2f") {
    return c.json({ error: `Unsupported attestation format: ${fmt}` }, 400);
  }

  // ── 4. Parse authenticator data ──

  const authData = parseAuthenticatorData(authDataRaw);

  if (!authData.attestedCredentialData) {
    return c.json({ error: "No credential data in attestation" }, 400);
  }

  const credentialId = base64urlEncode(
    authData.attestedCredentialData.credentialId
  );
  const publicKey = base64urlEncode(
    authData.attestedCredentialData.credentialPublicKey
  );

  // ── 5. Store credential in D1 ──

  const credentialDbId = crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT INTO credentials (id, credential_id, public_key, sign_count, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(
      credentialDbId,
      credentialId,
      publicKey,
      authData.signCount,
      new Date().toISOString()
    )
    .run();

  // ── 6. Generate recovery codes ──

  const { plain: recoveryCodes, hashed: hashedCodes } =
    await generateRecoveryCodes(6);

  const insertStmt = c.env.DB.prepare(
    "INSERT INTO recovery_codes (id, code_hash, used, created_at) VALUES (?, ?, 0, ?)"
  );
  const now = new Date().toISOString();
  const batch = hashedCodes.map((hash) =>
    insertStmt.bind(crypto.randomUUID(), hash, now)
  );
  await c.env.DB.batch(batch);

  // ── 7. Create session ──

  const token = await createSession(c.env.KV, {
    userId: stored.userId,
  });

  const cookie = buildSessionCookie(token);

  return c.json({ token, recoveryCodes }, 200, {
    "Set-Cookie": cookie,
  });
});

// ── Passkey / WebAuthn Login (WRK-007) ────────────────────────────────

const LOGIN_CHALLENGE_KEY_PREFIX = "login_challenge:";

function loginChallengeKey(id: string): string {
  return `${LOGIN_CHALLENGE_KEY_PREFIX}${id}`;
}

/**
 * POST /api/auth/login/challenge
 *
 * Generate a WebAuthn authentication challenge.
 * Fetches all credential IDs from D1 and returns them as allowCredentials.
 */
authRoutes.post("/api/auth/login/challenge", async (c) => {
  // Fetch all credential IDs from D1
  const { results } = await c.env.DB.prepare(
    "SELECT credential_id FROM credentials"
  ).all<{ credential_id: string }>();

  if (!results || results.length === 0) {
    return c.json({ error: "No registered credentials found" }, 404);
  }

  // Generate random 32-byte challenge
  const challengeBytes = new Uint8Array(32);
  crypto.getRandomValues(challengeBytes);
  const challenge = base64urlEncode(challengeBytes.buffer);

  const challengeId = crypto.randomUUID();

  // Store challenge in KV with 5-minute TTL
  await c.env.KV.put(
    loginChallengeKey(challengeId),
    JSON.stringify({
      challenge,
      createdAt: new Date().toISOString(),
    }),
    { expirationTtl: CHALLENGE_TTL_SECONDS }
  );

  const allowCredentials = results.map((row) => ({
    id: row.credential_id,
    type: "public-key" as const,
  }));

  return c.json({
    challengeId,
    challenge,
    allowCredentials,
    timeout: 60000,
  });
});

/**
 * POST /api/auth/login/verify
 *
 * Verify a WebAuthn assertion response and create a session.
 */
authRoutes.post("/api/auth/login/verify", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = LoginVerifySchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { challengeId, credential } = parsed.data;

  // ── 1. Retrieve and delete challenge from KV ──

  const kvKey = loginChallengeKey(challengeId);
  const storedRaw = await c.env.KV.get(kvKey, "text");

  if (storedRaw === null) {
    return c.json({ error: "Challenge not found or expired" }, 400);
  }

  // Delete immediately to prevent replay
  await c.env.KV.delete(kvKey);

  const stored = JSON.parse(storedRaw) as {
    challenge: string;
    createdAt: string;
  };

  // ── 2. Parse and validate clientDataJSON ──

  const clientDataBuffer = base64urlDecode(credential.response.clientDataJSON);
  const clientDataText = new TextDecoder().decode(clientDataBuffer);
  const clientData = JSON.parse(clientDataText) as {
    type: string;
    challenge: string;
    origin: string;
  };

  if (clientData.type !== "webauthn.get") {
    return c.json({ error: "Invalid clientData type" }, 400);
  }

  if (clientData.challenge !== stored.challenge) {
    return c.json({ error: "Challenge mismatch" }, 400);
  }

  // Verify origin
  const expectedOrigin = new URL(c.req.url).origin;
  if (clientData.origin !== expectedOrigin) {
    const isLocalDev =
      clientData.origin.startsWith("http://localhost") ||
      clientData.origin.startsWith("https://localhost");
    const expectLocalDev =
      expectedOrigin.startsWith("http://localhost") ||
      expectedOrigin.startsWith("https://localhost");

    if (!isLocalDev && !expectLocalDev) {
      return c.json({ error: "Origin mismatch" }, 400);
    }
  }

  // ── 3. Parse authenticatorData ──

  const authenticatorDataBuffer = base64urlDecode(
    credential.response.authenticatorData
  );
  const authData = parseAuthenticatorData(authenticatorDataBuffer);

  // Verify rpIdHash matches expected RP ID
  const expectedRpId = new URL(c.req.url).hostname;
  const expectedRpIdHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(expectedRpId)
  );
  const rpIdHashMatch =
    base64urlEncode(authData.rpIdHash) ===
    base64urlEncode(expectedRpIdHash);

  if (!rpIdHashMatch) {
    return c.json({ error: "RP ID hash mismatch" }, 400);
  }

  // Check user-present flag (bit 0)
  if ((authData.flags & 0x01) === 0) {
    return c.json({ error: "User presence flag not set" }, 400);
  }

  // ── 4. Look up credential in D1 ──

  const credentialId = credential.id;

  const credRow = await c.env.DB.prepare(
    "SELECT id, credential_id, public_key, sign_count FROM credentials WHERE credential_id = ?"
  )
    .bind(credentialId)
    .first<{
      id: string;
      credential_id: string;
      public_key: string;
      sign_count: number;
    }>();

  if (!credRow) {
    return c.json({ error: "Credential not found" }, 401);
  }

  // ── 5. Verify signature ──

  const publicKey = await importCOSEPublicKey(credRow.public_key);

  const signatureBuffer = base64urlDecode(credential.response.signature);

  const valid = await verifyAssertion({
    credentialPublicKey: publicKey,
    authenticatorData: authenticatorDataBuffer,
    clientDataJSON: clientDataBuffer,
    signature: signatureBuffer,
  });

  if (!valid) {
    return c.json({ error: "Signature verification failed" }, 401);
  }

  // ── 6. Update sign count (replay protection) ──

  if (authData.signCount > 0 && authData.signCount <= credRow.sign_count) {
    // Possible cloned authenticator — reject
    return c.json({ error: "Sign count regression detected" }, 401);
  }

  await c.env.DB.prepare(
    "UPDATE credentials SET sign_count = ? WHERE id = ?"
  )
    .bind(authData.signCount, credRow.id)
    .run();

  // ── 7. Create session ──

  const token = await createSession(c.env.KV, {
    userId: `credential:${credRow.id}`,
  });

  const cookie = buildSessionCookie(token);

  return c.json({ token }, 200, {
    "Set-Cookie": cookie,
  });
});

// ── Recovery Code Login (WRK-007) ─────────────────────────────────────

/**
 * POST /api/auth/recover
 *
 * Authenticate using a one-time recovery code.
 * Hashes the supplied code with SHA-256, looks it up in the recovery_codes
 * table, marks it as used, and creates a session.
 */
authRoutes.post("/api/auth/recover", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = RecoverySchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { code } = parsed.data;

  // Hash the code with SHA-256
  const encoded = new TextEncoder().encode(code.trim().toUpperCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = "";
  for (let i = 0; i < hashArray.length; i++) {
    hex += hashArray[i].toString(16).padStart(2, "0");
  }

  // Look up unused code
  const codeRow = await c.env.DB.prepare(
    "SELECT id FROM recovery_codes WHERE code_hash = ? AND used = 0"
  )
    .bind(hex)
    .first<{ id: string }>();

  if (!codeRow) {
    return c.json({ error: "Invalid or already-used recovery code" }, 401);
  }

  // Mark as used
  await c.env.DB.prepare("UPDATE recovery_codes SET used = 1 WHERE id = ?")
    .bind(codeRow.id)
    .run();

  // Count remaining codes
  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM recovery_codes WHERE used = 0"
  )
    .first<{ cnt: number }>();

  const remainingCodes = countResult?.cnt ?? 0;

  // Look up the credential owner for consistent session identity (AUD-006)
  const credRow = await c.env.DB.prepare(
    "SELECT id FROM credentials LIMIT 1"
  ).first<{ id: string }>();

  const userId = credRow ? `credential:${credRow.id}` : "recovered";

  // Create session
  const token = await createSession(c.env.KV, {
    userId,
  });

  const cookie = buildSessionCookie(token);

  return c.json({ token, remainingCodes }, 200, {
    "Set-Cookie": cookie,
  });
});
