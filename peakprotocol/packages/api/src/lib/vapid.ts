/**
 * VAPID helpers for Web Push notifications in Cloudflare Workers.
 *
 * All functions use the Web Crypto API (`crypto.subtle`) which is available
 * natively in the Workers runtime — no Node.js polyfills needed.
 *
 * PushForge expects JWK-format keys. The browser Push API expects the raw
 * public key bytes as `applicationServerKey`.
 */

// ── Constants ────────────────────────────────────────────────────────

/** VAPID subject — identifies the application server to the push service. */
export const VAPID_SUBJECT = "mailto:admin@peakprotocol.app";

// ── Types ────────────────────────────────────────────────────────────

/** A JSON-serialized JWK string as stored in Wrangler secrets. */
export type VapidJwkString = string;

// ── Key Import ───────────────────────────────────────────────────────

/**
 * Import the VAPID private key from its JWK secret string into a CryptoKey
 * suitable for signing VAPID JWTs.
 */
export async function importVapidPrivateKey(jwkString: VapidJwkString): Promise<CryptoKey> {
  const jwk: JsonWebKey = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false, // non-extractable — no reason to re-export in the Worker
    ["sign"],
  );
}

/**
 * Import the VAPID public key from its JWK secret string into a CryptoKey.
 * Marked extractable so it can be re-exported as raw bytes if needed.
 */
export async function importVapidPublicKey(jwkString: VapidJwkString): Promise<CryptoKey> {
  const jwk: JsonWebKey = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true, // extractable — needed to export as raw
    [],
  );
}

// ── Application Server Key ───────────────────────────────────────────

/**
 * Derive the base64url-encoded raw public key from a JWK string.
 *
 * This is the value the browser needs as `applicationServerKey` when
 * calling `pushManager.subscribe()`.
 */
export async function getApplicationServerKey(publicKeyJwk: VapidJwkString): Promise<string> {
  const cryptoKey = await importVapidPublicKey(publicKeyJwk);
  const rawBytes = await crypto.subtle.exportKey("raw", cryptoKey);
  return arrayBufferToBase64url(rawBytes);
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Encode an ArrayBuffer as a base64url string (no padding). */
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
