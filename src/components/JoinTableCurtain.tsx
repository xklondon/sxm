import { useEffect, useState } from 'react';
import { parseJoinTableParams } from '../engine/table/invites';
import { joinOnlineTable } from '../api/client';
import { isOnlineModeEnabled } from '../api/config';
import { setStoredOnlineTableId } from '../hooks/useOnlineMultiplayer';
import { consumePendingJoin } from '../AppRoot';
import type { AuthUser } from '../api/client';
import './JoinTableCurtain.css';

interface JoinTableCurtainProps {
  user: AuthUser;
  onJoined: (tableId: string) => void;
  onDismiss?: () => void;
}

export function JoinTableCurtain({ user, onJoined, onDismiss }: JoinTableCurtainProps) {
  const pendingSearch = consumePendingJoin() ?? window.location.search;
  const params = parseJoinTableParams(pendingSearch);
  const [displayName, setDisplayName] = useState(user.displayName ?? user.email.split('@')[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(nameOverride?: string) {
    if (!params) {
      setError('Invalid join link.');
      return;
    }
    const name = (nameOverride ?? displayName).trim();
    if (!name) {
      setError('Enter a display name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await joinOnlineTable({
        tableId: params.tableId,
        inviteId: params.inviteId,
        token: params.token,
        displayName: name,
      });
      setStoredOnlineTableId(result.tableId);
      onJoined(result.tableId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (params && user) {
      void handleJoin(user.displayName ?? user.email.split('@')[0] ?? 'Guest');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-join once on mount
  }, []);

  return (
    <div className="join-curtain">
      <div className="join-curtain__card">
        <h1>Join table</h1>
        <p className="join-curtain__lead">
          {busy
            ? 'Joining table…'
            : isOnlineModeEnabled()
              ? 'Completing your table join.'
              : 'Online mode is off — enable VITE_ONLINE_MODE to join hosted tables.'}
        </p>

        {params ? (
          <dl className="join-curtain__params">
            <dt>Table</dt>
            <dd>{params.tableId}</dd>
          </dl>
        ) : (
          <p className="join-curtain__warn">Missing or invalid join link parameters.</p>
        )}

        {!busy && (
          <label className="join-curtain__field">
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name at the table"
            />
          </label>
        )}

        {error && <p className="join-curtain__warn">{error}</p>}

        <div className="join-curtain__actions">
          {onDismiss && (
            <button type="button" className="secondary" onClick={onDismiss}>
              Back to app
            </button>
          )}
          <button
            type="button"
            disabled={busy || !params || !isOnlineModeEnabled()}
            onClick={() => void handleJoin()}
          >
            {busy ? 'Joining…' : 'Join table'}
          </button>
        </div>
      </div>
    </div>
  );
}
