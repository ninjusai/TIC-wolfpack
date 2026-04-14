/**
 * PasscodeLogin — Simple passcode/PIN login for single-user auth.
 *
 * Replaces the WebAuthn / device auth flows with a straightforward
 * passcode entry that authenticates against the APP_PASSCODE secret.
 */
import { createSignal, Show } from "solid-js";
import { setStoredToken, getApiBase, friendlyAuthError } from "../lib/auth";

type PasscodeState = "idle" | "verifying" | "success" | "error";

interface PasscodeLoginProps {
  onSuccess: (token: string) => void;
}

export default function PasscodeLogin(props: PasscodeLoginProps) {
  const [state, setState] = createSignal<PasscodeState>("idle");
  const [passcode, setPasscode] = createSignal("");
  const [errorMsg, setErrorMsg] = createSignal("");

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const code = passcode().trim();
    if (!code) {
      setErrorMsg("Please enter your passcode.");
      setState("error");
      return;
    }

    const apiBase = getApiBase();

    try {
      setState("verifying");

      const res = await fetch(`${apiBase}/api/auth/passcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ passcode: code }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const detail =
          errBody && typeof errBody === "object" && "error" in errBody
            ? (errBody as { error: string }).error
            : `Status ${res.status}`;
        throw new Error(detail);
      }

      const data: { token: string } = await res.json();

      setStoredToken(data.token);
      setState("success");
      props.onSuccess(data.token);
    } catch (err) {
      setErrorMsg(friendlyAuthError(err));
      setState("error");
    }
  }

  return (
    <div class="flex items-center justify-center min-h-screen">
      <div class="w-full max-w-xs p-6">
        <h2 class="text-2xl font-bold text-center mb-2">PeakProtocol</h2>
        <p class="text-center text-gray-500 mb-6">Enter your passcode to continue.</p>

        <form onSubmit={(e) => void handleSubmit(e)} class="flex flex-col gap-3">
          <input
            type="password"
            inputmode="numeric"
            autocomplete="current-password"
            placeholder="Passcode"
            value={passcode()}
            onInput={(e) => {
              setPasscode(e.currentTarget.value);
              if (state() === "error") {
                setState("idle");
                setErrorMsg("");
              }
            }}
            class="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={state() === "verifying" || state() === "success"}
            autofocus
          />

          <Show when={state() === "error"}>
            <p class="text-red-500 text-sm text-center">
              {errorMsg()}
            </p>
          </Show>

          <button
            type="submit"
            class="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={state() === "verifying" || state() === "success"}
          >
            <Show when={state() === "verifying"} fallback="Login">
              Verifying...
            </Show>
          </button>
        </form>

        <Show when={state() === "success"}>
          <p class="text-green-600 text-center mt-3">Signed in. Redirecting...</p>
        </Show>
      </div>
    </div>
  );
}
