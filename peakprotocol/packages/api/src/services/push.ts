/**
 * Web Push notification service (WRK-019).
 *
 * Sends push notifications to the stored subscription using the Web Push
 * protocol (RFC 8291 / RFC 8292).
 *
 * Dependencies:
 *   - VAPID helpers from ../lib/vapid
 *   - Web Crypto API (available natively in Cloudflare Workers)
 *
 * NOTE: Full RFC 8291 payload encryption (ECDH + HKDF + AES-128-GCM) is
 * implemented below. If issues arise, see the TODO markers.
 */

import type { Env } from "../env";
import { importVapidPrivateKey, VAPID_SUBJECT } from "../lib/vapid";

// ── Types ────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

interface StoredSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ── Constants ────────────────────────────────────────────────────────

const KV_KEY = "push_subscription";

// ── Public API ───────────────────────────────────────────────────────

/**
 * Send a push notification to the stored subscription.
 *
 * @returns `true` if the notification was sent successfully, `false` otherwise.
 */
export async function sendPushNotification(
  env: Env,
  payload: PushPayload,
): Promise<boolean> {
  // 1. Read subscription from KV
  const raw = await env.KV.get(KV_KEY);
  if (!raw) return false;

  const subscription: StoredSubscription = JSON.parse(raw);

  try {
    // 2. Build VAPID Authorization header
    const vapidHeaders = await buildVapidHeaders(
      subscription.endpoint,
      env.VAPID_PRIVATE_KEY,
      env.VAPID_PUBLIC_KEY,
    );

    // 3. Encrypt the payload per RFC 8291
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const encrypted = await encryptPayload(
      payloadBytes,
      subscription.keys.p256dh,
      subscription.keys.auth,
    );

    // 4. Send the push request
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        ...vapidHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        Urgency: "normal",
      },
      body: encrypted,
    });

    // 5. Handle 410 Gone — subscription no longer valid
    if (response.status === 410) {
      await env.KV.delete(KV_KEY);
      return false;
    }

    return response.ok;
  } catch (error) {
    console.error("[push] Failed to send notification:", error);
    return false;
  }
}

// ── VAPID JWT ────────────────────────────────────────────────────────

/**
 * Build the VAPID Authorization and Crypto-Key headers.
 *
 * Produces an ES256-signed JWT per RFC 8292.
 */
async function buildVapidHeaders(
  endpoint: string,
  privateKeyJwk: string,
  publicKeyJwk: string,
): Promise<Record<string, string>> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  // JWT header
  const header = { typ: "JWT", alg: "ES256" };

  // JWT payload — expires in 12 hours
  const jwtPayload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  };

  const headerB64 = objectToBase64url(header);
  const payloadB64 = objectToBase64url(jwtPayload);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Sign with the VAPID private key
  const privateKey = await importVapidPrivateKey(privateKeyJwk);
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );

  // Convert DER signature to raw r||s format (64 bytes for P-256)
  const signature = derToRaw(new Uint8Array(signatureBuffer));
  const signatureB64 = arrayBufferToBase64url(signature.buffer as ArrayBuffer);
  const jwt = `${unsignedToken}.${signatureB64}`;

  // Export public key as raw uncompressed point for Crypto-Key header
  const pubKey = JSON.parse(publicKeyJwk) as JsonWebKey;
  const pubCryptoKey = await crypto.subtle.importKey(
    "jwk",
    pubKey,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    [],
  );
  const rawPubKey = await crypto.subtle.exportKey("raw", pubCryptoKey);
  const pubKeyB64 = arrayBufferToBase64url(rawPubKey);

  return {
    Authorization: `vapid t=${jwt}, k=${pubKeyB64}`,
  };
}

// ── RFC 8291 Payload Encryption ──────────────────────────────────────

/**
 * Encrypt a push notification payload using the subscriber's public key
 * and auth secret, per RFC 8291 (aes128gcm content encoding).
 *
 * Steps:
 * 1. Generate an ephemeral ECDH key pair
 * 2. Derive a shared secret via ECDH with the subscriber's p256dh key
 * 3. Derive encryption key and nonce via HKDF
 * 4. Encrypt with AES-128-GCM
 * 5. Build the aes128gcm header + ciphertext
 */
async function encryptPayload(
  plaintext: Uint8Array,
  p256dhBase64url: string,
  authBase64url: string,
): Promise<ArrayBuffer> {
  // Decode subscriber keys
  const subscriberPubKeyBytes = base64urlToUint8Array(p256dhBase64url);
  const authSecret = base64urlToUint8Array(authBase64url);

  // Import subscriber public key for ECDH
  const subscriberPubKey = await crypto.subtle.importKey(
    "raw",
    subscriberPubKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // Generate ephemeral ECDH key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  // Export ephemeral public key (raw, 65 bytes uncompressed)
  const ephemeralPubKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey),
  );

  // ECDH: derive shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPubKey },
    ephemeralKeyPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Derive PRK using auth secret (RFC 8291 Section 3.3)
  // PRK = HKDF-Extract(salt=authSecret, IKM=sharedSecret)
  // Then info = "WebPush: info\0" || subscriberPubKey || ephemeralPubKey
  const authInfo = concatUint8Arrays(
    new TextEncoder().encode("WebPush: info\0"),
    subscriberPubKeyBytes,
    ephemeralPubKeyRaw,
  );

  const prkKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveBits"],
  );

  // IKM for second HKDF
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecret, info: authInfo },
      prkKey,
      256,
    ),
  );

  // Generate a 16-byte salt for this message
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive content encryption key (CEK): 16 bytes
  // CEK = HKDF(salt, IKM, "Content-Encoding: aes128gcm\0", 16)
  const ikmKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);

  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    ikmKey,
    128,
  );
  const cek = new Uint8Array(cekBits);

  // Derive nonce: 12 bytes
  // nonce = HKDF(salt, IKM, "Content-Encoding: nonce\0", 12)
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    ikmKey,
    96,
  );
  const nonce = new Uint8Array(nonceBits);

  // Pad plaintext: add a delimiter byte (0x02 for final record) after content
  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext);
  padded[plaintext.length] = 0x02; // Final record delimiter

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    "AES-GCM",
    false,
    ["encrypt"],
  );

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      padded,
    ),
  );

  // Build the aes128gcm header:
  //   salt (16) || rs (4, uint32 big-endian) || idlen (1) || keyid (65) || ciphertext
  const recordSize = plaintext.length + 1 + 16; // padded + AES-GCM tag (16 bytes)
  const header = new Uint8Array(16 + 4 + 1 + ephemeralPubKeyRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = ephemeralPubKeyRaw.length;
  header.set(ephemeralPubKeyRaw, 21);

  // Combine header + ciphertext
  const result = new Uint8Array(header.length + ciphertext.length);
  result.set(header);
  result.set(ciphertext, header.length);

  return result.buffer as ArrayBuffer;
}

// ── Encoding Helpers ─────────────────────────────────────────────────

function objectToBase64url(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  return arrayBufferToBase64url(bytes.buffer as ArrayBuffer);
}

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert a DER-encoded ECDSA signature to raw r||s format.
 * crypto.subtle.sign with ECDSA returns DER on some platforms;
 * Workers typically return raw — this handles both.
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // If already 64 bytes, assume raw format
  if (der.length === 64) return der;

  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  const raw = new Uint8Array(64);
  let offset = 2; // skip 0x30 and total length

  // Read r
  offset++; // skip 0x02
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;

  // Read s
  offset++; // skip 0x02
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 32 + (32 - sLen) : 32;
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((acc, a) => acc + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
