/**
 * AuthGuard — SolidJS component that wraps protected routes.
 *
 * Simplified for single-user passcode auth:
 *  1. Loading: show spinner while validating stored token
 *  2. Authenticated: render children
 *  3. Not authenticated: show passcode login
 */
import {
  ErrorBoundary,
  Show,
  type JSX,
} from "solid-js";
import { useAuth } from "../stores/auth";
import { getApiBase } from "../lib/auth";
import PasscodeLogin from "./PasscodeLogin";

export default function AuthGuard(props: { children: JSX.Element }): JSX.Element {
  const auth = useAuth();

  function handlePasscodeSuccess(token: string): void {
    auth.login(token, "passcode");
  }

  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div class="auth-guard auth-guard--error">
          <div class="auth-guard__error">
            <h2>Something Went Wrong</h2>
            <p>
              Unable to connect to the server. Please check that the API backend
              is running and try again.
            </p>
            <p class="auth-guard__error-detail">
              {err instanceof Error ? err.message : String(err)}
            </p>
            <button class="auth-guard__btn" onClick={reset}>
              Retry
            </button>
          </div>
        </div>
      )}
    >
      {/* Loading state — checking stored token */}
      <Show when={auth.isLoading()}>
        <div class="auth-guard" role="status">
          <div class="auth-guard__loading">
            <p>Checking authentication...</p>
          </div>
        </div>
      </Show>

      {/* Authenticated — render protected content */}
      <Show when={auth.isAuthenticated()}>
        {props.children}
      </Show>

      {/* Not authenticated — show passcode login */}
      <Show when={!auth.isLoading() && !auth.isAuthenticated()}>
        <div class="auth-guard">
          <PasscodeLogin onSuccess={handlePasscodeSuccess} />
        </div>
      </Show>
    </ErrorBoundary>
  );
}
