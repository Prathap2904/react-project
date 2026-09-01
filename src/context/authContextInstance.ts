/**
 * authContextInstance.ts
 *
 * Exports the AuthContext React context object and the useAuthContext hook.
 * Kept in a separate file from AuthProvider so that React Fast Refresh can
 * correctly identify AuthContext.tsx as a component-only file.
 */

import { createContext, useContext } from 'react';
import type { AccessRole, AuthStatus, CurrentUser } from './authTypes';

export type { AccessRole, AuthStatus, CurrentUser };

export interface AuthContextValue {
  currentUser: CurrentUser | null;
  authStatus: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Internal hook (used by useAuth.ts) ──────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
}
