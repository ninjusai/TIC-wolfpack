/**
 * VAPID Key Generation Script
 * ============================================================
 *
 * VAPID (Voluntary Application Server Identification) keys are used to
 * authenticate your server when sending Web Push notifications. The push
 * service (e.g. FCM, Mozilla autopush) verifies the VAPID JWT signature
 * to confirm the notification came from a trusted application server.
 *
 * Key types produced:
 *   - Private key (JWK)  — used server-side by PushForge to sign VAPID tokens.
 *                          Store as a Wrangler secret. NEVER expose to the frontend.
 *   - Public key  (JWK)  — used server-side by PushForge for key operations.
 *                          Store as a Wrangler secret alongside the private key.
 *   - Public key  (raw)  — base64url-encoded raw bytes of the P-256 public point.
 *                          Used in the browser as `applicationServerKey` when
 *                          calling `pushManager.subscribe()`.
 *
 * How to rotate keys:
 *   1. Run this script again to generate a fresh key pair.
 *   2. Update Wrangler secrets:
 *        wrangler secret put VAPID_PRIVATE_KEY
 *        wrangler secret put VAPID_PUBLIC_KEY
 *   3. Update the frontend `VAPID_PUBLIC_KEY` constant with the new raw public key.
 *   4. Existing push subscriptions will become invalid — users must re-subscribe.
 *
 * Usage:
 *   npx tsx scripts/generate-vapid-keys.ts
 */

async function main() {
  // Generate an ECDSA P-256 key pair via Web Crypto API
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true, // extractable — we need to export the keys
    ["sign", "verify"],
  );

  // Export keys as JWK (what PushForge expects)
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  // Export public key as raw bytes for the browser Push API applicationServerKey
  const publicRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicRawBase64url = arrayBufferToBase64url(publicRaw);

  // Serialize JWKs as JSON strings (what you'll paste into wrangler secret put)
  const privateJwkJson = JSON.stringify(privateJwk);
  const publicJwkJson = JSON.stringify(publicJwk);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  VAPID Key Pair Generated (ECDSA P-256)");
  console.log("═══════════════════════════════════════════════════════════");

  console.log("\n── 1. VAPID Private Key (JWK) ──────────────────────────");
  console.log("   Store as Wrangler secret — NEVER expose to the frontend.\n");
  console.log(privateJwkJson);
  console.log("\n   Run:");
  console.log('   wrangler secret put VAPID_PRIVATE_KEY');
  console.log("   Then paste the JSON above when prompted.\n");

  console.log("── 2. VAPID Public Key (JWK) ───────────────────────────");
  console.log("   Store as Wrangler secret for server-side use.\n");
  console.log(publicJwkJson);
  console.log("\n   Run:");
  console.log('   wrangler secret put VAPID_PUBLIC_KEY');
  console.log("   Then paste the JSON above when prompted.\n");

  console.log("── 3. Application Server Key (base64url raw) ───────────");
  console.log("   Use in the frontend for pushManager.subscribe().\n");
  console.log(publicRawBase64url);
  console.log("\n   Set this value in:");
  console.log("   packages/web/src/lib/push.ts → VAPID_PUBLIC_KEY\n");

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Done. Keep the private key secret!");
  console.log("═══════════════════════════════════════════════════════════");
}

/** Encode an ArrayBuffer as a base64url string (no padding). */
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

main().catch((err) => {
  console.error("Failed to generate VAPID keys:", err);
  process.exit(1);
});
