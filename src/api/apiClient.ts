/**
 * apiClient.ts
 *
 * Centralized fetch wrapper for all REST API calls.
 *
 * Token storage: sessionStorage
 *   - Token is scoped to the current browser tab/session.
 *   - Cleared automatically when the tab or browser is closed.
 *   - Safer than localStorage (no cross-session persistence).
 *   - The backend currently returns the JWT in a JSON body (not HttpOnly cookies),
 *     so sessionStorage is the least-risky practical approach for this dev stage.
 *   - A future step can upgrade to HttpOnly cookies by adding a backend
 *     /auth/cookie-login endpoint and switching to credentials: 'include'.
 */

export const API_BASE = 'http://localhost:3000';

export const TOKEN_KEY = 'auth_token';
export const USER_KEY  = 'auth_user';

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredAuth(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

// ─── User cache helpers ───────────────────────────────────────────────────────

export function getStoredUser<T>(): T | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredUser<T>(user: T): void {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
  /** If true, the Authorization header is NOT added (e.g. login endpoint). */
  anonymous?: boolean;
};

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { anonymous = false, headers = {}, ...rest } = options;

  const authHeaders: Record<string, string> = {};

  if (!anonymous) {
    const token = getStoredToken();
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
  });

  if (!response.ok) {
    // Try to extract a structured error message from the backend
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      message = body?.message ?? message;
    } catch {
      // non-JSON response – keep the status-based message
    }
    throw new Error(message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}
