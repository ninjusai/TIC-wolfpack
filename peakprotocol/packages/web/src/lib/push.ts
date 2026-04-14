/**
 * Web Push configuration for the PeakProtocol frontend.
 *
 * The VAPID public key is the base64url-encoded raw public key used as
 * `applicationServerKey` when subscribing to push notifications.
 *
 * Generate a new key pair with:
 *   npx tsx packages/api/scripts/generate-vapid-keys.ts
 */

// VAPID public key for Web Push subscription.
// Replace this value after running the generation script.
export const VAPID_PUBLIC_KEY = "PLACEHOLDER_REPLACE_AFTER_KEY_GENERATION";

/**
 * Convert a base64url string to a Uint8Array.
 *
 * The Push API's `subscribe()` expects `applicationServerKey` as a
 * BufferSource, so we need to decode the base64url VAPID public key.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Restore standard base64 characters and padding
  let base64 = base64String.replace(/-/g, "+").replace(/_/g, "/");
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
