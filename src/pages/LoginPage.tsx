/**
 * LoginPage.tsx
 *
 * Authentication login form.
 * Calls AuthContext.login() which in turn calls POST /auth/login.
 *
 * Features:
 *   - Email + Password inputs
 *   - Loading state (spinner inside button, inputs disabled)
 *   - Error message with shake animation
 *   - Keyboard accessible (Enter submits form)
 *   - Matches existing app design tokens (no hard-coded colors)
 */

import { useState, type FormEvent } from 'react';
import useAuth from '../hooks/useAuth';
import './LoginPage.css';

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      // On success, AuthContext updates authStatus → 'authenticated'
      // App.tsx re-renders and shows the main application automatically.
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';

      // Friendly messages for common cases
      if (message.includes('401') || message.toLowerCase().includes('invalid credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else if (
        message.toLowerCase().includes('failed to fetch') ||
        message.toLowerCase().includes('networkerror') ||
        message.toLowerCase().includes('load failed')
      ) {
        setError('Cannot reach the server. Make sure the backend is running on localhost:3000.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Brand */}
        <div className="login-brand">
          <span className="login-brand-dot" aria-hidden="true" />
          <p className="login-brand-name">Team Directory</p>
        </div>

        {/* Heading */}
        <div className="login-heading-group">
          <h2>Welcome back</h2>
          <p>Sign in to access your team workspace.</p>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>

          {/* Email */}
          <div className="login-field">
            <label htmlFor="login-email" className="login-label">
              Email address
            </label>
            <div className="login-input-wrapper">
              <svg
                className="login-input-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <input
                id="login-email"
                type="email"
                className="login-input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label htmlFor="login-password" className="login-label">
              Password
            </label>
            <div className="login-input-wrapper">
              <svg
                className="login-input-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <input
                id="login-password"
                type="password"
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="login-error" role="alert" id="login-error-msg">
              <svg
                className="login-error-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="login-submit-btn"
            type="submit"
            className="login-submit-btn"
            disabled={loading || !email || !password}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Footer note */}
        <p className="login-footer-note">
          Credentials are managed by your administrator.
        </p>

      </div>
    </div>
  );
}
