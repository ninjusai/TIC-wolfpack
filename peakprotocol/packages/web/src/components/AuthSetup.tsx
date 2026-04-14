/**
 * AuthSetup — SolidJS component for first-time WebAuthn passkey registration.
 *
 * Flow:
 *  1. Check if WebAuthn is available
 *  2. Request a registration challenge from the API
 *  3. Call navigator.credentials.create() to create a passkey
 *  4. Send the attestation to the API for verification
 *  5. Display recovery codes (shown once — user must save them)
 *  6. Store the session token
 */
import { createSignal, Show, For } from "solid-js";
import {
  isWebAuthnAvailable,
  setStoredToken,
  getApiBase,
  friendlyAuthError,
} from "../lib/auth";
import { base64urlToBuffer, bufferToBase64url } from "../lib/base64url";

type SetupState =
  | "idle"
  | "unsupported"
  | "requesting"
  | "creating"
  | "verifying"
  | "complete"
  | "error";

interface ChallengeResponse {
  challengeId: string;
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
}

interface VerifyResponse {
  token: string;
  recoveryCodes: string[];
}

interface AuthSetupProps {
  onSuccess?: (token: string) => void;
  onSkipToDevice?: () => void;
}

export default function AuthSetup(props: AuthSetupProps) {
  const [state, setState] = createSignal<SetupState>("idle");
  const [errorMsg, setErrorMsg] = createSignal("");
  const [recoveryCodes, setRecoveryCodes] = createSignal<string[]>([]);
  const [codesCopied, setCodesCopied] = createSignal(false);

  async function startRegistration(): Promise<void> {
    // Check WebAuthn support
    if (!isWebAuthnAvailable()) {
      setState("unsupported");
      return;
    }

    const apiBase = getApiBase();

    try {
      // ── Step 1: Request challenge ──
      setState("requesting");

      const challengeRes = await fetch(`${apiBase}/api/auth/register/challenge`, {
        method: "POST",
        credentials: "include",
      });

      if (!challengeRes.ok) {
        throw new Error(`Challenge request failed: ${challengeRes.status}`);
      }

      const challengeData: ChallengeResponse = await challengeRes.json();

      // ── Step 2: Create credential via browser API ──
      setState("creating");

      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64urlToBuffer(challengeData.challenge),
        rp: {
          name: challengeData.rp.name,
          id: challengeData.rp.id,
        },
        user: {
          id: base64urlToBuffer(challengeData.user.id),
          name: challengeData.user.name,
          displayName: challengeData.user.displayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },   // ES256
          { alg: -257, type: "public-key" },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      };

      const credential = (await navigator.credentials.create({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error("Credential creation was cancelled");
      }

      const attestationResponse =
        credential.response as AuthenticatorAttestationResponse;

      // ── Step 3: Send attestation to server ──
      setState("verifying");

      const attestationPayload = {
        challengeId: challengeData.challengeId,
        attestation: {
          id: credential.id,
          rawId: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
            attestationObject: bufferToBase64url(
              attestationResponse.attestationObject
            ),
          },
        },
      };

      const verifyRes = await fetch(`${apiBase}/api/auth/register/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(attestationPayload),
      });

      if (!verifyRes.ok) {
        const errBody = await verifyRes.json().catch(() => null);
        const detail =
          errBody && typeof errBody === "object" && "error" in errBody
            ? (errBody as { error: string }).error
            : `Status ${verifyRes.status}`;
        throw new Error(`Verification failed: ${detail}`);
      }

      const verifyData: VerifyResponse = await verifyRes.json();

      // Store session token
      setStoredToken(verifyData.token);
      setRecoveryCodes(verifyData.recoveryCodes);
      setState("complete");

      // Notify parent
      if (props.onSuccess) {
        props.onSuccess(verifyData.token);
      }
    } catch (err) {
      setErrorMsg(friendlyAuthError(err));
      setState("error");
    }
  }

  async function copyRecoveryCodes(): Promise<void> {
    const codes = recoveryCodes().join("\n");
    try {
      await navigator.clipboard.writeText(codes);
      setCodesCopied(true);
    } catch {
      // Fallback: select the text area for manual copy
      setCodesCopied(false);
    }
  }

  return (
    <div class="auth-setup">
      {/* Idle state — show setup button */}
      <Show when={state() === "idle"}>
        <div class="auth-setup__intro">
          <h2>Set Up Your Passkey</h2>
          <p>
            PeakProtocol uses a passkey to secure your data to this device.
            No passwords, no accounts — just biometric or PIN confirmation.
          </p>
          <button
            class="auth-setup__btn"
            onClick={() => void startRegistration()}
          >
            Create Passkey
          </button>
          <Show when={props.onSkipToDevice}>
            <button
              class="auth-setup__btn auth-setup__btn--secondary"
              style="margin-top: 12px; opacity: 0.7;"
              onClick={() => props.onSkipToDevice?.()}
            >
              Skip — use device auth instead
            </button>
          </Show>
        </div>
      </Show>

      {/* WebAuthn not supported */}
      <Show when={state() === "unsupported"}>
        <div class="auth-setup__unsupported">
          <h2>Passkeys Not Supported</h2>
          <p>
            This browser does not support passkeys (WebAuthn). Please use a
            modern browser such as Chrome, Safari, Firefox, or Edge.
          </p>
        </div>
      </Show>

      {/* In-progress states */}
      <Show
        when={
          state() === "requesting" ||
          state() === "creating" ||
          state() === "verifying"
        }
      >
        <div class="auth-setup__progress" role="status">
          <Show when={state() === "requesting"}>
            <p>Preparing registration...</p>
          </Show>
          <Show when={state() === "creating"}>
            <p>Follow your browser's prompt to create a passkey...</p>
          </Show>
          <Show when={state() === "verifying"}>
            <p>Verifying your passkey...</p>
          </Show>
        </div>
      </Show>

      {/* Success — show recovery codes */}
      <Show when={state() === "complete"}>
        <div class="auth-setup__complete">
          <h2>Passkey Created</h2>
          <p>Your passkey has been registered. You're all set.</p>

          <div class="auth-setup__recovery">
            <h3>Recovery Codes</h3>
            <p class="auth-setup__warning">
              Save these codes in a safe place. They are the only way to recover
              access if you lose your device. They will not be shown again.
            </p>
            <ul class="auth-setup__codes">
              <For each={recoveryCodes()}>
                {(code) => (
                  <li>
                    <code>{code}</code>
                  </li>
                )}
              </For>
            </ul>
            <button
              class="auth-setup__btn auth-setup__btn--secondary"
              onClick={() => void copyRecoveryCodes()}
            >
              {codesCopied() ? "Copied!" : "Copy Codes"}
            </button>
          </div>
        </div>
      </Show>

      {/* Error state */}
      <Show when={state() === "error"}>
        <div class="auth-setup__error">
          <h2>Registration Failed</h2>
          <p>{errorMsg()}</p>
          <button
            class="auth-setup__btn"
            onClick={() => {
              setState("idle");
              setErrorMsg("");
            }}
          >
            Try Again
          </button>
          <Show when={props.onSkipToDevice}>
            <button
              class="auth-setup__btn auth-setup__btn--secondary"
              style="margin-top: 12px; opacity: 0.7;"
              onClick={() => props.onSkipToDevice?.()}
            >
              Skip — use device auth instead
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
