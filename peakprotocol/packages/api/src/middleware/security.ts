import { secureHeaders } from "hono/secure-headers";

/**
 * Security headers middleware (WRK-010).
 *
 * Uses Hono's built-in secureHeaders() with overrides for API-specific policy.
 *
 * Headers applied:
 * - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
 * - Referrer-Policy: strict-origin-when-cross-origin
 */
export const securityHeaders = () =>
  secureHeaders({
    strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
    xContentTypeOptions: "nosniff",
    xFrameOptions: "DENY",
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
    referrerPolicy: "strict-origin-when-cross-origin",
  });
