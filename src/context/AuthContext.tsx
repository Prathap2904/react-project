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
 *   Resolved synchronously via lazy useState initialisers so that the
 *   component tree never renders with a stale 'loading' flicker caused
 *   by a synchronous setState inside useEffect.
 *
 * Important field distinction:
 *   currentUser.role       = chatbot persona / job title (unchanged from existing app)
 *   currentUser.accessRole = application RBAC role      (new field, used for future guards)
 *
 * Fast-refresh compliance:
 *   AuthContext object and useAuthContext hook live in authContextInstance.ts
 *   so that this file only exports the AuthProvider component.
 */

import { useState, useCallback, type ReactNode } from 'react';

import {
  apiFetch,
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from '../api/apiClient';

import { AuthContext } from './authContextInstance';
import type { CurrentUser, AuthStatus } from './authTypes';

// ─── Backend login response shape ─────────────────────────────────────────────

interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

// ─── Lazy initialisers – run once at mount, never inside an effect ─────────────

function resolveInitialUser(): CurrentUser | null {
  return getStoredUser<CurrentUser>();
}

function resolveInitialStatus(): AuthStatus {
  const token = getStoredToken();
  const user  = getStoredUser<CurrentUser>();

  if (token && user) {
    return 'authenticated';
  }

  // Clean up any partial state (token without user, or vice-versa).
  clearStoredAuth();
  return 'unauthenticated';
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initialisers run synchronously on first render – no useEffect needed.
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(resolveInitialUser);
  const [authStatus, setAuthStatus]   = useState<AuthStatus>(resolveInitialStatus);

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
