import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActiveTableSummary } from '../types/activeTables';
import { fetchMyTables } from '../api/client';
import { readStoredOnlineTableId } from '../onlineTableStorage';
import { listSavedGames, type SavedGameMeta } from '../storage/gameStorage';

export interface LoadTableEntry {
  id: string;
  label: string;
  source: 'stored-online' | 'online' | 'local';
  tableId?: string;
  savedGameId?: string;
}

interface LoadTableListProps {
  onlineMode: boolean;
  onLoad: (entry: LoadTableEntry) => void;
  onBack: () => void;
}

function formatGameLabel(game: string): string {
  if (game === 'zilch') return 'Zilch';
  if (game === 'holdem') return "Texas Hold'em";
  return 'Blackjack';
}

export function LoadTableList({ onlineMode, onLoad, onBack }: LoadTableListProps) {
  const [onlineTables, setOnlineTables] = useState<ActiveTableSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storedOnlineId = readStoredOnlineTableId();
  const localSaved: SavedGameMeta[] = listSavedGames();

  const loadOnlineTables = useCallback(async () => {
    if (!onlineMode) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMyTables();
      setOnlineTables(list.filter((t) => t.access === 'open'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your tables');
    } finally {
      setLoading(false);
    }
  }, [onlineMode]);

  useEffect(() => {
    void loadOnlineTables();
  }, [loadOnlineTables]);

  const entries = useMemo(() => {
    const rows: LoadTableEntry[] = [];
    if (onlineMode && storedOnlineId) {
      rows.push({
        id: `stored:${storedOnlineId}`,
        label: `Last online session (${storedOnlineId.slice(0, 8)}…)`,
        source: 'stored-online',
        tableId: storedOnlineId,
      });
    }
    for (const table of onlineTables) {
      rows.push({
        id: `online:${table.tableId}`,
        label: table.name || formatGameLabel(table.game),
        source: 'online',
        tableId: table.tableId,
      });
    }
    for (const meta of localSaved) {
      rows.push({
        id: `local:${meta.id}`,
        label: meta.label,
        source: 'local',
        savedGameId: meta.id,
      });
    }
    return rows;
  }, [localSaved, onlineMode, onlineTables, storedOnlineId]);

  return (
    <div className="entry-lobby__card">
      <button type="button" className="secondary entry-lobby__back" onClick={onBack}>
        Back
      </button>
      <h2 className="entry-lobby__title">Load a Table</h2>
      <p className="entry-lobby__subtitle">
        Resume a saved session explicitly. Reloading the app no longer opens your last table automatically.
      </p>
      {loading && <p className="entry-lobby-panel__status">Loading your tables…</p>}
      {error && (
        <p className="entry-lobby-panel__error" role="alert">
          {error}
        </p>
      )}
      {entries.length === 0 && !loading && (
        <p className="entry-lobby-panel__empty">No saved tables yet. Open or join a table first.</p>
      )}
      <ul className="entry-lobby-panel__list">
        {entries.map((entry) => (
          <li key={entry.id} className="entry-lobby-panel__item">
            <div className="entry-lobby-panel__item-head">
              <strong>{entry.label}</strong>
              <span className="entry-lobby-panel__badge">
                {entry.source === 'local'
                  ? 'Local save'
                  : entry.source === 'stored-online'
                    ? 'Last session'
                    : 'Online'}
              </span>
            </div>
            <button type="button" className="entry-lobby-panel__action" onClick={() => onLoad(entry)}>
              Load
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
