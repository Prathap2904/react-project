/**
 * useAuth.ts
 *
 * Convenience hook for consuming the AuthContext.
 * Throws if used outside <AuthProvider> to catch wiring mistakes early.
 */

import { useAuthContext } from '../context/authContextInstance';

export const useAuth = useAuthContext;
export default useAuth;
