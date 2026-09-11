import { useEffect, useState } from 'react';
import App from './App';
import { JoinTableCurtain } from './components/JoinTableCurtain';
import { LoginScreen } from './screens/LoginScreen';
import {
  fetchInvitePreview,
  fetchMe,
  isSessionCheckConnectivityError,
  type AuthUser,
} from './api/client';
import { isPublicAuthPath, shouldShowGlobalSessionLoading } from './auth/authBoot';
import { isOnlineModeEnabled, apiPath } from './api/config';
import { resolveBootTableId } from './onlineTableStorage';
import { parseJoinTableParams } from './engine/table/invites';
import {
  inviteTokenFromSearch as inviteTokenFromQuery,
  logInviteAuthClient,
  resolvePostAuthInviteResume,
} from './auth/inviteAuthResume';
import { BOOT_STAGES, markBootStage, markBootSucceeded } from './debug/bootDiagnostics';
import { AuthFetchError, accessDeniedMessage } from './auth/authErrors';
import { ClientConfigScreen, isClientConfigPath } from './debug/ClientConfigScreen';

const PENDING_JOIN_KEY = 'sxmcards:pending-join';

// Storage can throw on locked-down mobile browsers (privacy mode) — never let
// that crash the render and leave a blank/green screen.
export function savePendingJoin(search: string): void {
  try {
    sessionStorage.setItem(PENDING_JOIN_KEY, search);
  } catch {
    /* storage unavailable */
  }
}

export function getPendingJoin(): string | null {
  try {
    return sessionStorage.getItem(PENDING_JOIN_KEY);
  } catch {
    return null;
  }
}

export function consumePendingJoin(): string | null {
  try {
    const value = sessionStorage.getItem(PENDING_JOIN_KEY);
    if (value) {
      sessionStorage.removeItem(PENDING_JOIN_KEY);
    }
    return value;
  } catch {
    return null;
  }
}

function inviteTokenFromSearch(search: string): string | null {
  return inviteTokenFromQuery(search) ?? parseJoinTableParams(search)?.token ?? null;
}

export function AppRoot() {
  markBootStage(BOOT_STAGES.appRoot);
  const onlineMode = isOnlineModeEnabled();
  const [authLoading, setAuthLoading] = useState(onlineMode);

  useEffect(() => {
    // React has mounted AppRoot — the bundle booted. Clear the stall overlay.
    markBootSucceeded();
  }, []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteTableName, setInviteTableName] = useState<string | null>(null);
  const pathname = window.location.pathname;
  const isLoginPath = pathname === '/login' || pathname.endsWith('/login');
  const isJoinPath = pathname === '/join-table' || pathname.endsWith('/join-table');
  const isPublicPath = isPublicAuthPath(pathname);
  const loginParams = new URLSearchParams(window.location.search);
  const loginError = loginParams.get('error');
  const inviteAcceptToken = loginParams.get('token');
  const invitedEmailParam = loginParams.get('invitedEmail');
  const inviteTableNameParam = loginParams.get('inviteTableName');
  const pendingSearch = isJoinPath ? window.location.search : getPendingJoin() ?? '';

  useEffect(() => {
    if (!onlineMode) {
      return;
    }
    setSessionWarning(null);
    setAccessDenied(null);
    fetchMe()
      .then(setUser)
      .catch((err) => {
        setUser(null);
        if (err instanceof AuthFetchError && err.status === 403) {
          setAccessDenied(accessDeniedMessage(err.code));
          return;
        }
        if (!isPublicAuthPath(pathname) && isSessionCheckConnectivityError(err)) {
          setSessionWarning('Could not reach the server. You can still request a magic link.');
        }
      })
      .finally(() => {
        markBootStage(BOOT_STAGES.authMe);
        setAuthLoading(false);
      });
  }, [onlineMode]);

  useEffect(() => {
    if (!onlineMode) {
      return;
    }
    const token = inviteTokenFromSearch(pendingSearch);
    if (!token) {
      return;
    }
    fetchInvitePreview(token)
      .then((preview) => {
        setInviteEmail(preview.invitedEmail);
        setInviteTableName(preview.tableName);
      })
      .catch(() => {
        /* preview optional */
      });
  }, [onlineMode, pendingSearch]);

  useEffect(() => {
    if (!onlineMode || authLoading || !user) {
      return;
    }
    const token =
      inviteAcceptToken ?? inviteTokenFromSearch(pendingSearch) ?? inviteTokenFromSearch(window.location.search);
    if (!token) {
      return;
    }
    if (isJoinPath || isLoginPath) {
      logInviteAuthClient('invite-resume', {
        callbackTarget: `/api/tables/invites/accept`,
        reason: 'authenticated-accept',
      });
      window.location.assign(apiPath(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`));
    }
  }, [onlineMode, authLoading, user, isJoinPath, isLoginPath, inviteAcceptToken, pendingSearch]);

  useEffect(() => {
    if (!onlineMode || authLoading || !user || isJoinPath) {
      return;
    }
    const resume = resolvePostAuthInviteResume({
      search: window.location.search,
      pendingJoin: getPendingJoin(),
    });
    if (resume) {
      logInviteAuthClient('invite-resume', { callbackTarget: resume, reason: 'pending-join' });
      window.location.assign(resume);
    }
  }, [onlineMode, authLoading, user, isJoinPath]);

  useEffect(() => {
    if (!onlineMode || authLoading || !user || !isLoginPath) {
      return;
    }
    const resume = resolvePostAuthInviteResume({
      search: window.location.search,
      pendingJoin: getPendingJoin(),
    });
    if (resume) {
      logInviteAuthClient('invite-resume', { callbackTarget: resume, reason: 'login-returnTo' });
      window.location.replace(resume);
      return;
    }
    window.location.replace('/');
  }, [onlineMode, authLoading, user, isLoginPath]);

  useEffect(() => {
    if (!onlineMode || authLoading) {
      return;
    }
    if (!user && !isPublicPath) {
      window.location.replace('/login');
    }
  }, [onlineMode, authLoading, user, isPublicPath]);

  if (isClientConfigPath(pathname)) {
    return <ClientConfigScreen />;
  }

  if (shouldShowGlobalSessionLoading(pathname, authLoading, onlineMode)) {
    return (
      <main className="login-screen">
        <p>Loading session…</p>
      </main>
    );
  }

  if (onlineMode && isLoginPath) {
    if (user) {
      return (
        <main className="login-screen">
          <p>Signing you in…</p>
        </main>
      );
    }
    return (
      <LoginScreen
        error={accessDenied ?? loginError}
        sessionWarning={sessionWarning}
        checkingSession={authLoading}
        invitedEmail={inviteEmail ?? invitedEmailParam}
        inviteTableName={inviteTableName ?? inviteTableNameParam}
      />
    );
  }

  if (onlineMode && isJoinPath) {
    const joinToken = inviteTokenFromSearch(window.location.search);
    if (joinToken && user) {
      return (
        <main className="login-screen">
          <p>Accepting invite…</p>
        </main>
      );
    }
    if (!user) {
      if (joinToken) {
        savePendingJoin(window.location.search);
      }
      return (
        <LoginScreen
          error={accessDenied ?? 'Sign in to join this table.'}
          sessionWarning={sessionWarning}
          checkingSession={authLoading}
          invitedEmail={inviteEmail}
          inviteTableName={inviteTableName}
        />
      );
    }
    return (
      <JoinTableCurtain
        user={user}
        onJoined={(tableId) => {
          window.history.replaceState({}, '', '/');
          window.location.assign(`/?table=${encodeURIComponent(tableId)}`);
        }}
      />
    );
  }

  if (onlineMode && !user) {
    // Unauthenticated on a protected route: a redirect effect is sending us to
    // /login. Show visible text (not null) so we never flash a blank/green screen.
    return (
      <main className="login-screen">
        <p>Redirecting to sign in…</p>
      </main>
    );
  }

  const tableFromUrl = new URLSearchParams(window.location.search).get('table');
  const forceNewTable = new URLSearchParams(window.location.search).get('newTable') === '1';
  const bootTableId = resolveBootTableId(tableFromUrl, forceNewTable);

  return <App user={user} onlineMode={onlineMode} bootTableId={bootTableId} forceNewTable={forceNewTable} />;
}
