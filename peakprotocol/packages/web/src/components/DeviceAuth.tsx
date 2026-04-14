/**
 * DeviceAuth — SolidJS fallback auth component (WRK-008).
 *
 * Automatically requests a device-bound session token when WebAuthn
 * is not available. Stores the token in localStorage as backup
 * (the server also sets an httpOnly cookie).
 */
import { createSignal, onMount, Show } from "solid-js";
import {
  isWebAuthnAvailable,
  getStoredToken,
  setStoredToken,
  getApiBase,
  friendlyAuthError,
} from "../lib/auth";

interface DeviceTokenResponse {
  token: string;
}

interface DeviceAuthProps {
  onSuccess?: (token: string) => void;
  /** When true, skip the WebAuthn check and always request a device token. */
  force?: boolean;
}

type AuthState = "checking" | "webauthn" | "requesting" | "trusted" | "error";

export default function DeviceAuth(props: DeviceAuthProps) {
  const [state, setState] = createSignal<AuthState>("checking");
  const [errorMsg, setErrorMsg] = createSignal<string>("");

  onMount(async () => {
    // If WebAuthn is supported and we're not forced, this component does nothing.
    if (isWebAuthnAvailable() && !props.force) {
      setState("webauthn");
      return;
    }

    // Already have a device token — skip request.
    if (getStoredToken()) {
      setState("trusted");
      return;
    }

    // Request a device-bound token from the API.
    setState("requesting");
    try {
      const res = await fetch(`${getApiBase()}/api/auth/device-token`, {
        method: "POST",
        credentials: "include", // ensure cookie is accepted
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data: DeviceTokenResponse = await res.json();
      setStoredToken(data.token);
      setState("trusted");

      // Notify parent
      if (props.onSuccess) {
        props.onSuccess(data.token);
      }
    } catch (err) {
      setErrorMsg(friendlyAuthError(err));
      setState("error");
    }
  });

  return (
    <Show when={state() !== "checking" && state() !== "webauthn"}>
      <div class="device-auth" role="status">
        <Show when={state() === "requesting"}>
          <p>Securing this device…</p>
        </Show>

        <Show when={state() === "trusted"}>
          <p>
            This device has been trusted. Your data is secured to this browser.
          </p>
          <p class="device-auth__warning">
            If you clear browser data, you'll need to use a recovery code to
            regain access.
          </p>
        </Show>

        <Show when={state() === "error"}>
          <p class="device-auth__error">
            Could not secure this device: {errorMsg()}
          </p>
          <button
            class="device-auth__btn"
            onClick={() => {
              setState("checking");
              setErrorMsg("");
              // Re-trigger the mount logic manually
              void (async () => {
                setState("requesting");
                try {
                  const res = await fetch(`${getApiBase()}/api/auth/device-token`, {
                    method: "POST",
                    credentials: "include",
                  });
                  if (!res.ok) {
                    throw new Error(`Server responded with ${res.status}`);
                  }
                  const data: DeviceTokenResponse = await res.json();
                  setStoredToken(data.token);
                  setState("trusted");
                  if (props.onSuccess) {
                    props.onSuccess(data.token);
                  }
                } catch (retryErr) {
                  setErrorMsg(friendlyAuthError(retryErr));
                  setState("error");
                }
              })();
            }}
          >
            Retry
          </button>
        </Show>
      </div>
    </Show>
  );
}
