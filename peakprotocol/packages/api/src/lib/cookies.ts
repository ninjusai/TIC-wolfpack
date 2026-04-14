/**
 * Cookie helpers for session token management.
 *
 * All cookies are httpOnly + secure + sameSite=strict to mitigate XSS and CSRF.
 */

const COOKIE_NAME = "pp_session";

/**
 * Build a Set-Cookie header value for a session token.
 *
 * @param token     - The session token value.
 * @param maxAgeDays - Cookie lifetime in days (default 30).
 * @returns A fully-formed Set-Cookie header value.
 */
export function buildSessionCookie(
  token: string,
  maxAgeDays: number = 30
): string {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  return [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

/**
 * Build a Set-Cookie header that clears the session cookie.
 */
export function buildClearCookie(): string {
  return [
    `${COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

/**
 * Extract the session token from a Cookie header string.
 *
 * @returns The token value, or null if not present.
 */
export function parseSessionCookie(cookieHeader: string): string | null {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;

  const value = match.slice(COOKIE_NAME.length + 1);
  return value || null;
}
