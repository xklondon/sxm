import { useCallback, useEffect, useState } from 'react';
import type { ActiveTableSummary } from '../types/activeTables';
import { fetchMyTables, joinOnlineTable } from '../api/client';
import { loadProfile } from '../storage/profileStorage';
import './ActiveTablesPanel.css';

interface ActiveTablesPanelProps {
  open: boolean;
  onClose: () => void;
  onOpenTable: (tableId: string) => void;
  currentTableId?: string | null;
}

function formatGameLabel(game: string): string {
  if (game === 'zilch') return 'Zilch';
  if (game === 'holdem') return "Texas Hold'em";
  return 'Blackjack';
}

function formatModeLabel(mode: ActiveTableSummary['mode']): string {
  if (mode === 'practice') return 'Practice';
  if (mode === 'challenge') return 'Challenge';
  return '—';
}

export function ActiveTablesPanel({
  open,
  onClose,
  onOpenTable,
  currentTableId = null,
}: ActiveTablesPanelProps) {
  const [tables, setTables] = useState<ActiveTableSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMyTables();
      setTables(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadTables();
  }, [open, loadTables]);

  if (!open) {
    return null;
  }

  async function handleAction(table: ActiveTableSummary) {
    if (table.access === 'open') {
      onOpenTable(table.tableId);
      onClose();
      return;
    }
    if (!table.inviteId || !table.inviteToken) {
      setError('Invite details missing — ask the host for a new link.');
      return;
    }
    setJoiningId(table.tableId);
    setError(null);
    try {
      const profile = loadProfile();
      const displayName = profile.name.trim() || table.players[0]?.split('@')[0] || 'Player';
      const result = await joinOnlineTable({
        tableId: table.tableId,
        inviteId: table.inviteId,
        token: table.inviteToken,
        displayName,
      });
      onOpenTable(result.tableId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join table');
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="active-tables-overlay" role="dialog" aria-label="Active tables">
      <div className="active-tables-panel">
        <header className="active-tables-panel__header">
          <h2>Active Tables</h2>
          <button type="button" className="secondary" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p className="active-tables-panel__sub">
          Tables you host or were invited to. Unrelated tables are not shown.
        </p>
        {loading && <p className="active-tables-panel__status">Loading…</p>}
        {error && (
          <p className="active-tables-panel__error" role="alert">
            {error}
          </p>
        )}
        {!loading && tables.length === 0 && (
          <p className="active-tables-panel__empty">No open tables right now.</p>
        )}
        <ul className="active-tables-panel__list">
          {tables.map((table) => (
            <li key={table.tableId} className="active-tables-panel__item">
              <div className="active-tables-panel__item-main">
                <strong>{formatGameLabel(table.game)}</strong>
                <span className="active-tables-panel__badge">{formatModeLabel(table.mode)}</span>
                {table.wager && (
                  <span className="active-tables-panel__wager">{table.wager}</span>
                )}
              </div>
              <dl className="active-tables-panel__meta">
                <div>
                  <dt>Bank</dt>
                  <dd>{table.bank}</dd>
                </div>
                <div>
                  <dt>Players</dt>
                  <dd>{table.players.length > 0 ? table.players.join(', ') : '—'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{table.status}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{new Date(table.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="active-tables-panel__action"
                disabled={joiningId === table.tableId || currentTableId === table.tableId}
                onClick={() => void handleAction(table)}
              >
                {currentTableId === table.tableId
                  ? 'Current table'
                  : joiningId === table.tableId
                    ? 'Joining…'
                    : table.access === 'join'
                      ? 'Join'
                      : 'Open'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
