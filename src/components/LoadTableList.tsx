import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActiveTableSummary } from '../types/activeTables';
import { fetchMyTables } from '../api/client';
import { readStoredOnlineTableId } from '../onlineTableStorage';
import {
  listSavedGames,
  loadArchivedGame,
  type SavedGameMeta,
} from '../storage/gameStorage';

export interface LoadTableEntry {
  id: string;
  label: string;
  source: 'stored-online' | 'online' | 'local';
  tableId?: string;
  savedGameId?: string;
  game?: string;
  mode?: string;
  wager?: string | null;
  players?: string[];
  playerCount?: number;
  status?: string;
  savedAt?: string;
}

interface LoadTableListProps {
  onlineMode: boolean;
  onLoad: (entry: LoadTableEntry) => void;
}

function formatGameLabel(game: string): string {
  if (game === 'zilch') return 'Zilch';
  if (game === 'holdem' || game === 'texas-holdem') return "Texas Hold'em";
  return 'Blackjack';
}

function formatSavedTime(iso?: string): string {
  if (!iso) return 'Unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function buildLocalEntry(meta: SavedGameMeta): LoadTableEntry {
  const state = loadArchivedGame(meta.id);
  const gameType = state?.tableGame ?? state?.session?.gameType ?? 'blackjack';
  const agreement = state?.tableMeta?.agreement?.stakeDescription;
  const playerIds = state?.session?.playerIds ?? [];
  return {
    id: `local:${meta.id}`,
    label: meta.label,
    source: 'local',
    savedGameId: meta.id,
    game: formatGameLabel(gameType),
    mode: state?.tableMeta?.bankerSetup?.mode === 'bot' ? 'Practice' : 'Challenge',
    wager: agreement ?? null,
    playerCount: playerIds.length,
    status: state?.tableMeta?.gameStatus ?? 'unknown',
    savedAt: meta.savedAt,
  };
}

function buildOnlineEntry(table: ActiveTableSummary): LoadTableEntry {
  return {
    id: `online:${table.tableId}`,
    label: table.name || formatGameLabel(table.game),
    source: 'online',
    tableId: table.tableId,
    game: formatGameLabel(table.game),
    mode: table.mode === 'unknown' ? undefined : table.mode,
    wager: table.wager,
    players: table.players,
    playerCount: table.playerCount,
    status: table.status,
    savedAt: table.createdAt,
  };
}

export function LoadTableList({ onlineMode, onLoad }: LoadTableListProps) {
  const [onlineTables, setOnlineTables] = useState<ActiveTableSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      const matched = onlineTables.find((t) => t.tableId === storedOnlineId);
      rows.push({
        id: `stored:${storedOnlineId}`,
        label: matched?.name || `Last online session (${storedOnlineId.slice(0, 8)}…)`,
        source: 'stored-online',
        tableId: storedOnlineId,
        game: matched ? formatGameLabel(matched.game) : undefined,
        mode: matched?.mode === 'unknown' ? undefined : matched?.mode,
        wager: matched?.wager ?? null,
        players: matched?.players,
        playerCount: matched?.playerCount,
        status: matched?.status,
        savedAt: matched?.createdAt,
      });
    }
    for (const table of onlineTables) {
      if (storedOnlineId && table.tableId === storedOnlineId) {
        continue;
      }
      rows.push(buildOnlineEntry(table));
    }
    for (const meta of localSaved) {
      rows.push(buildLocalEntry(meta));
    }
    return rows;
  }, [localSaved, onlineMode, onlineTables, storedOnlineId]);

  function toggleExpanded(entryId: string) {
    setExpandedId((current) => (current === entryId ? null : entryId));
  }

  return (
    <>
      <p className="entry-lobby__subtitle entry-lobby__subtitle--panel">
        Resume a saved session explicitly. Reloading the app no longer opens your last table
        automatically.
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
        {entries.map((entry) => {
          const expanded = expandedId === entry.id;
          return (
            <li
              key={entry.id}
              className={`entry-lobby-panel__item${expanded ? ' entry-lobby-panel__item--expanded' : ''}`}
            >
              <button
                type="button"
                className="entry-lobby-panel__item-toggle"
                aria-expanded={expanded}
                onClick={() => toggleExpanded(entry.id)}
              >
                <div className="entry-lobby-panel__item-head">
                  <strong>{entry.label}</strong>
                  <span className="entry-lobby-panel__badge">
                    {entry.source === 'local'
                      ? 'Local save'
                      : entry.source === 'stored-online'
                        ? 'Last session'
                        : 'Online'}
                  </span>
                  {entry.game && (
                    <span className="entry-lobby-panel__badge">{entry.game}</span>
                  )}
                </div>
                {entry.savedAt && (
                  <p className="entry-lobby-panel__saved-at">Saved {formatSavedTime(entry.savedAt)}</p>
                )}
              </button>
              {expanded && (
                <div className="entry-lobby-panel__details">
                  <dl className="entry-lobby-panel__meta">
                    {entry.game && (
                      <div>
                        <dt>Game</dt>
                        <dd>{entry.game}</dd>
                      </div>
                    )}
                    {entry.mode && (
                      <div>
                        <dt>Mode</dt>
                        <dd>{entry.mode}</dd>
                      </div>
                    )}
                    {entry.status && (
                      <div>
                        <dt>Status</dt>
                        <dd>{entry.status}</dd>
                      </div>
                    )}
                    {entry.wager && (
                      <div>
                        <dt>Wager</dt>
                        <dd>{entry.wager}</dd>
                      </div>
                    )}
                    {(entry.playerCount != null || entry.players?.length) && (
                      <div>
                        <dt>Players</dt>
                        <dd>
                          {entry.players?.length
                            ? entry.players.join(', ')
                            : String(entry.playerCount ?? 0)}
                        </dd>
                      </div>
                    )}
                    {entry.savedAt && (
                      <div>
                        <dt>Saved</dt>
                        <dd>{formatSavedTime(entry.savedAt)}</dd>
                      </div>
                    )}
                  </dl>
                  <button
                    type="button"
                    className="entry-lobby-panel__action"
                    onClick={() => onLoad(entry)}
                  >
                    ReOpen
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
