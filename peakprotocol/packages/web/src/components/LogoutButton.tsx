/**
 * LogoutButton — Simple logout control using the auth context (WRK-009).
 *
 * Can be placed in any layout or header. Calls auth.logout() on click.
 */
import { createSignal, Show } from "solid-js";
import { useAuth } from "../stores/auth";

export default function LogoutButton() {
  const auth = useAuth();
  const [loggingOut, setLoggingOut] = createSignal(false);

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);
    try {
      await auth.logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Show when={auth.isAuthenticated()}>
      <button
        class="logout-btn"
        onClick={() => void handleLogout()}
        disabled={loggingOut()}
      >
        {loggingOut() ? "Signing out..." : "Sign Out"}
      </button>
    </Show>
  );
}
