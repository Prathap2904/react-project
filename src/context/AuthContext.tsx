/**
 * AuthContext.tsx
 *
 * Central authentication state for the application.
 *
 * Provides:
 *   currentUser   – the authenticated user's safe profile (no passwordHash)
 *   authStatus    – 'loading' | 'authenticated' | 'unauthenticated'
 *   login()       – POST /auth/login, store token + user, set currentUser
 *   logout()      – clear sessionStorage, reset currentUser
 *
 * Session restoration:
 *   On mount, the context reads the token and cached user from sessionStorage.
 *   If both are present the session is restored immediately (no network call).
 *   If either is missing the user must log in.
 *
 * Important field distinction:
 *   currentUser.role       = chatbot persona / job title (unchanged from existing app)
 *   currentUser.accessRole = application RBAC role      (new field, used for future guards)
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

import {
  apiFetch,
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from '../api/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccessRole = 'admin' | 'manager' | 'member';

/** The authenticated user's safe profile. passwordHash is never stored client-side. */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  /** Application RBAC role. NOT the chatbot persona. */
  accessRole: AccessRole;
  /** Chatbot persona / job title. Unchanged from existing User entity. */
  role: string;
  status: string;
  avatar: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  currentUser: CurrentUser | null;
  authStatus: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// ─── Backend login response shape ─────────────────────────────────────────────

interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  // ── Session restoration on mount ────────────────────────────────────────────
  useEffect(() => {
    const token = getStoredToken();
    const user  = getStoredUser<CurrentUser>();

    if (token && user) {
      // Both token and user data found – restore the session.
      setCurrentUser(user);
      setAuthStatus('authenticated');
    } else {
      // No valid session – show login.
      clearStoredAuth(); // clean up any partial state
      setAuthStatus('unauthenticated');
    }
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    // POST /auth/login is unauthenticated – do not send an Authorization header.
    const response = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      anonymous: true,
      body: JSON.stringify({ email, password }),
    });

    // Persist token and user to sessionStorage.
    setStoredToken(response.accessToken);
    setStoredUser<CurrentUser>(response.user);

    // Update context state.
    setCurrentUser(response.user);
    setAuthStatus('authenticated');
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearStoredAuth();
    setCurrentUser(null);
    setAuthStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, authStatus, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Internal hook (used by useAuth.ts) ──────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
}
