import { useCallback, useEffect, useState } from 'react';
import type { ActiveTableSummary } from '../types/activeTables';
import {
  fetchActiveTables,
  joinOnlineTable,
  requestTableAccess,
} from '../api/client';
import { loadProfile } from '../storage/profileStorage';

interface ActiveTablesListProps {
  onOpenTable: (tableId: string) => void;
  onBack: () => void;
}

function formatGameLabel(game: string): string {
  if (game === 'zilch') return 'Zilch';
  if (game === 'holdem') return "Texas Hold'em";
  return 'Blackjack';
}

function formatAccessLabel(access: ActiveTableSummary['access']): string {
  switch (access) {
    case 'open':
      return 'Member';
    case 'join':
      return 'Invited';
    case 'pending':
      return 'Request pending';
    case 'request':
      return 'Request access';
    default:
      return access;
  }
}

function actionLabel(table: ActiveTableSummary): string {
  if (table.access === 'open') return 'Open';
  if (table.access === 'join') return 'Join';
  if (table.access === 'pending') return 'Pending';
  return 'Request Access';
}

export function ActiveTablesList({ onOpenTable, onBack }: ActiveTablesListProps) {
  const [tables, setTables] = useState<ActiveTableSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchActiveTables();
      setTables(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load active tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  async function handleAction(table: ActiveTableSummary) {
    if (table.access === 'open') {
      onOpenTable(table.tableId);
      return;
    }
    if (table.access === 'pending') {
      return;
    }
    if (table.access === 'request') {
      setBusyId(table.tableId);
      setError(null);
      try {
        const profile = loadProfile();
        const displayName = profile.name.trim() || 'Player';
        await requestTableAccess(table.tableId, displayName);
        await loadTables();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not request access');
      } finally {
        setBusyId(null);
      }
      return;
    }
    if (!table.inviteId || !table.inviteToken) {
      setError('Invite details missing — ask the host for a new link.');
      return;
    }
    setBusyId(table.tableId);
    setError(null);
    try {
      const profile = loadProfile();
      const displayName = profile.name.trim() || table.host.split('@')[0] || 'Player';
      const result = await joinOnlineTable({
        tableId: table.tableId,
        inviteId: table.inviteId,
        token: table.inviteToken,
        displayName,
      });
      onOpenTable(result.tableId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join table');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="entry-lobby__card">
      <button type="button" className="secondary entry-lobby__back" onClick={onBack}>
        Back
      </button>
      <h2 className="entry-lobby__title">Join a Table</h2>
      <p className="entry-lobby__subtitle">
        Active online tables you can open, join with an invite, or request access to enter.
      </p>
      {loading && <p className="entry-lobby-panel__status">Loading active tables…</p>}
      {error && (
        <p className="entry-lobby-panel__error" role="alert">
          {error}
        </p>
      )}
      {!loading && tables.length === 0 && (
        <p className="entry-lobby-panel__empty">No active tables right now.</p>
      )}
      <ul className="entry-lobby-panel__list">
        {tables.map((table) => (
          <li key={table.tableId} className="entry-lobby-panel__item">
            <div className="entry-lobby-panel__item-head">
              <strong>{table.name || formatGameLabel(table.game)}</strong>
              <span className="entry-lobby-panel__badge">{formatGameLabel(table.game)}</span>
              <span className="entry-lobby-panel__badge">{formatAccessLabel(table.access)}</span>
            </div>
            <dl className="entry-lobby-panel__meta">
              <div>
                <dt>Host</dt>
                <dd>{table.host}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{table.status}</dd>
              </div>
              <div>
                <dt>Players</dt>
                <dd>{table.playerCount}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="entry-lobby-panel__action"
              disabled={busyId === table.tableId || table.access === 'pending'}
              onClick={() => void handleAction(table)}
            >
              {busyId === table.tableId ? 'Working…' : actionLabel(table)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
