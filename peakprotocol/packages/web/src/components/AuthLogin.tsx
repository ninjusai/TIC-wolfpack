/**
 * AuthLogin — SolidJS component for WebAuthn passkey login.
 *
 * Flow:
 *  1. Request an authentication challenge from the API
 *  2. Call navigator.credentials.get() — browser shows passkey prompt
 *  3. Send the assertion to the API for verification
 *  4. On success: store token, redirect to dashboard
 *  5. On failure: show error with retry / fallback options
 *
 * States: idle, requesting, authenticating (browser prompt), verifying, success, error
 */
import { createSignal, Show } from "solid-js";
import {
  isWebAuthnAvailable,
  setStoredToken,
  getApiBase,
  friendlyAuthError,
} from "../lib/auth";
import { base64urlToBuffer, bufferToBase64url } from "../lib/base64url";

type LoginState =
  | "idle"
  | "unsupported"
  | "requesting"
  | "authenticating"
  | "verifying"
  | "success"
  | "error";

interface LoginChallengeResponse {
  challengeId: string;
  challenge: string;
  allowCredentials: Array<{ id: string; type: "public-key" }>;
  timeout: number;
}

interface LoginVerifyResponse {
  token: string;
}

interface AuthLoginProps {
  /** Called after successful login. Defaults to navigating to "/". */
  onSuccess?: (token: string) => void;
  /** Called when user clicks "use device auth" fallback. */
  onFallback?: () => void;
}

export default function AuthLogin(props: AuthLoginProps) {
  const [state, setState] = createSignal<LoginState>("idle");
  const [errorMsg, setErrorMsg] = createSignal("");

  async function startLogin(): Promise<void> {
    if (!isWebAuthnAvailable()) {
      setState("unsupported");
      return;
    }

    const apiBase = getApiBase();

    try {
      // ── Step 1: Request challenge ──
      setState("requesting");

      const challengeRes = await fetch(`${apiBase}/api/auth/login/challenge`, {
        method: "POST",
        credentials: "include",
      });

      if (!challengeRes.ok) {
        const errBody = await challengeRes.json().catch(() => null);
        const detail =
          errBody && typeof errBody === "object" && "error" in errBody
            ? (errBody as { error: string }).error
            : `Status ${challengeRes.status}`;
        throw new Error(`Challenge request failed: ${detail}`);
      }

      const challengeData: LoginChallengeResponse = await challengeRes.json();

      // ── Step 2: Get assertion via browser API ──
      setState("authenticating");

      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64urlToBuffer(challengeData.challenge),
        allowCredentials: challengeData.allowCredentials.map((cred) => ({
          id: base64urlToBuffer(cred.id),
          type: "public-key" as const,
          transports: ["internal" as AuthenticatorTransport],
        })),
        timeout: challengeData.timeout,
        userVerification: "preferred",
      };

      const assertion = (await navigator.credentials.get({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!assertion) {
        throw new Error("Authentication was cancelled");
      }

      const assertionResponse =
        assertion.response as AuthenticatorAssertionResponse;

      // ── Step 3: Send assertion to server ──
      setState("verifying");

      const assertionPayload = {
        challengeId: challengeData.challengeId,
        credential: {
          id: assertion.id,
          rawId: bufferToBase64url(assertion.rawId),
          type: assertion.type,
          response: {
            clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
            authenticatorData: bufferToBase64url(
              assertionResponse.authenticatorData
            ),
            signature: bufferToBase64url(assertionResponse.signature),
            userHandle: assertionResponse.userHandle
              ? bufferToBase64url(assertionResponse.userHandle)
              : null,
          },
        },
      };

      const verifyRes = await fetch(`${apiBase}/api/auth/login/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(assertionPayload),
      });

      if (!verifyRes.ok) {
        const errBody = await verifyRes.json().catch(() => null);
        const detail =
          errBody && typeof errBody === "object" && "error" in errBody
            ? (errBody as { error: string }).error
            : `Status ${verifyRes.status}`;
        throw new Error(`Verification failed: ${detail}`);
      }

      const verifyData: LoginVerifyResponse = await verifyRes.json();

      // Store session token
      setStoredToken(verifyData.token);
      setState("success");

      // Notify parent or redirect
      if (props.onSuccess) {
        props.onSuccess(verifyData.token);
      } else if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (err) {
      setErrorMsg(friendlyAuthError(err));
      setState("error");
    }
  }

  return (
    <div class="auth-login">
      {/* Idle state — show login button */}
      <Show when={state() === "idle"}>
        <div class="auth-login__intro">
          <h2>Welcome Back</h2>
          <p>Sign in with your passkey to continue.</p>
          <button
            class="auth-login__btn"
            onClick={() => void startLogin()}
          >
            Sign In with Passkey
          </button>
        </div>
      </Show>

      {/* WebAuthn not supported */}
      <Show when={state() === "unsupported"}>
        <div class="auth-login__unsupported">
          <h2>Passkeys Not Supported</h2>
          <p>
            This browser does not support passkeys (WebAuthn). Please use a
            modern browser, or use device-based authentication.
          </p>
          <Show when={!!props.onFallback}>
            <button
              class="auth-login__btn auth-login__btn--secondary"
              onClick={() => props.onFallback?.()}
            >
              Use Device Auth
            </button>
          </Show>
        </div>
      </Show>

      {/* In-progress states */}
      <Show
        when={
          state() === "requesting" ||
          state() === "authenticating" ||
          state() === "verifying"
        }
      >
        <div class="auth-login__progress" role="status">
          <Show when={state() === "requesting"}>
            <p>Preparing login...</p>
          </Show>
          <Show when={state() === "authenticating"}>
            <p>Follow your browser's prompt to authenticate...</p>
          </Show>
          <Show when={state() === "verifying"}>
            <p>Verifying your identity...</p>
          </Show>
        </div>
      </Show>

      {/* Success */}
      <Show when={state() === "success"}>
        <div class="auth-login__success">
          <h2>Signed In</h2>
          <p>Redirecting to your dashboard...</p>
        </div>
      </Show>

      {/* Error state */}
      <Show when={state() === "error"}>
        <div class="auth-login__error">
          <h2>Login Failed</h2>
          <p>{errorMsg()}</p>
          <div class="auth-login__actions">
            <button
              class="auth-login__btn"
              onClick={() => {
                setState("idle");
                setErrorMsg("");
              }}
            >
              Try Again
            </button>
            <Show when={!!props.onFallback}>
              <button
                class="auth-login__btn auth-login__btn--secondary"
                onClick={() => props.onFallback?.()}
              >
                Use Device Auth
              </button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
