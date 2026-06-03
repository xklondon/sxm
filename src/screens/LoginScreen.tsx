import { useState } from 'react';
import { requestMagicLink } from '../api/client';
import './LoginScreen.css';

interface LoginScreenProps {
  error?: string | null;
  sessionWarning?: string | null;
  checkingSession?: boolean;
  invitedEmail?: string | null;
  inviteTableName?: string | null;
}

export function LoginScreen({
  error: initialError,
  sessionWarning = null,
  checkingSession = false,
  invitedEmail = null,
  inviteTableName = null,
}: LoginScreenProps) {
  const [email, setEmail] = useState(invitedEmail ?? '');
  const [rememberMe, setRememberMe] = useState(true);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  const isDev = import.meta.env.DEV;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setDevLink(null);
    try {
      const result = await requestMagicLink(email, rememberMe);
      if (isDev) {
        setMessage('Magic link sent. Check your email.');
      } else {
        setMessage('Check your email for a sign-in link.');
      }
      if (result.devLink) {
        try {
          const link = new URL(result.devLink, window.location.origin);
          link.protocol = window.location.protocol;
          link.host = window.location.host;
          setDevLink(link.toString());
        } catch {
          setDevLink(result.devLink);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen__card">
        <p className="login-screen__eyebrow">SXM Casino</p>
        <h1>SXMCARDS</h1>
        <p className="login-screen__lead">
          {inviteTableName
            ? `You have been invited to ${inviteTableName}. Confirm your email to join.`
            : invitedEmail
              ? `You have been invited. Confirm ${invitedEmail} to join.`
              : 'Enter your email to receive a magic sign-in link.'}
        </p>
        {checkingSession && <p className="login-screen__hint">Checking session…</p>}
        {sessionWarning && <p className="login-screen__warn">{sessionWarning}</p>}
        <form onSubmit={handleSubmit}>
          <label className="login-screen__field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              readOnly={Boolean(invitedEmail)}
            />
          </label>
          <label className="login-screen__remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me on this device
          </label>
          {error && <p className="login-screen__error">{error}</p>}
          {message && <p className="login-screen__msg">{message}</p>}
          {devLink && (
            <p className="login-screen__dev">
              Dev sign-in link: <a href={devLink}>{devLink}</a>
            </p>
          )}
          <button type="submit" className="ds-btn ds-btn--primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      </div>
    </div>
  );
}
