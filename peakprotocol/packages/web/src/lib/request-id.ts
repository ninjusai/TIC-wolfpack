/**
 * Generate a unique request ID for idempotent API requests.
 *
 * Attach the returned value as `X-Request-Id` header on POST/PUT/DELETE
 * calls to prevent duplicate submissions when the same request is retried.
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
