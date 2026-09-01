/**
 * authTypes.ts
 *
 * Shared TypeScript types for the authentication layer.
 */

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
