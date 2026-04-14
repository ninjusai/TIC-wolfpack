/**
 * Auth Context — SolidJS context provider for authentication state (WRK-009).
 *
 * Provides reactive auth state and actions to the entire app.
 * On mount, validates any stored token against the API.
 */
import {
  createContext,
  createSignal,
  createResource,
  useContext,
  type JSX,
} from "solid-js";
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  getApiBase,
} from "../lib/auth";

export interface AuthContextValue {
  /** Whether the user is currently authenticated. */
  isAuthenticated: () => boolean;
  /** Whether the initial token validation is still in progress. */
  isLoading: () => boolean;
  /** The current session token, or null. */
  token: () => string | null;
  /** How the user authenticated — "passkey", "device", or null. */
  authMethod: () => "passkey" | "device" | "passcode" | null;
  /** Set authenticated state after a successful login. */
  login: (token: string, method: "passkey" | "device" | "passcode") => void;
  /** Clear auth state and call the logout endpoint. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>();

/**
 * Validate a stored token against the API.
 * Returns the token if valid, null otherwise.
 */
async function validateStoredToken(): Promise<string | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch(`${getApiBase()}/api/auth/device-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
    });

    if (res.ok) {
      return token;
    }

    // Token is invalid — clear it
    clearStoredToken();
    return null;
  } catch {
    // Network error — clear token to be safe
    clearStoredToken();
    return null;
  }
}

export function AuthProvider(props: { children: JSX.Element }): JSX.Element {
  const [authToken, setAuthToken] = createSignal<string | null>(null);
  const [authMethod, setAuthMethod] = createSignal<
    "passkey" | "device" | "passcode" | null
  >(null);

  // Validate the stored token on mount using createResource
  const [validatedToken] = createResource(validateStoredToken);

  // Derived state: authenticated if we have a token from login() or from validation
  const isAuthenticated = (): boolean => {
    if (authToken()) return true;
    if (!validatedToken.loading && validatedToken() !== undefined) {
      return validatedToken() !== null;
    }
    return false;
  };

  const isLoading = (): boolean => validatedToken.loading;

  const token = (): string | null => {
    // Prefer the token set via login() (most recent action)
    const loginToken = authToken();
    if (loginToken) return loginToken;
    // Fall back to the validated stored token
    if (!validatedToken.loading) {
      return validatedToken() ?? null;
    }
    return null;
  };

  const login = (newToken: string, method: "passkey" | "device" | "passcode"): void => {
    setStoredToken(newToken);
    setAuthToken(newToken);
    setAuthMethod(method);
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch(`${getApiBase()}/api/auth/device-logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token()}`,
        },
        credentials: "include",
      });
    } catch {
      // Best-effort logout — clear local state regardless
    }

    clearStoredToken();
    setAuthToken(null);
    setAuthMethod(null);
  };

  const contextValue: AuthContextValue = {
    isAuthenticated,
    isLoading,
    token,
    authMethod,
    login,
    logout,
  };

  return (
    // @ts-ignore — SolidJS context provider pattern
    <AuthContext.Provider value={contextValue}>
      {props.children}
    </AuthContext.Provider>
  );
}

/**
 * Access the auth context. Must be called within an AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
