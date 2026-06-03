import type { GameState } from '../types';
import type { ScoreLedgerEntry } from '../types/scoreLedger';
import { log } from '../utils/logger';

const STORAGE_KEY = 'sxmcards:score-ledger:v1';

/** Display-only filter: hide score rows for a table while its game is still in progress. */
export function loadScoreLedgerDisplayEntries(options?: {
  activeTableId?: string | null;
  gameStatus?: GameState['tableMeta']['gameStatus'];
}): ScoreLedgerEntry[] {
  const entries = loadScoreLedgerEntries();
  if (!options?.activeTableId || options.gameStatus === 'ended' || !options.gameStatus) {
    return entries;
  }
  return entries.filter((entry) => entry.tableId !== options.activeTableId);
}

export function loadScoreLedgerEntries(): ScoreLedgerEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as ScoreLedgerEntry[];
  } catch (err) {
    log.warn('Failed to load score ledger', { err });
    return [];
  }
}

export function saveScoreLedgerEntries(entries: ScoreLedgerEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    log.warn('Failed to save score ledger', { err });
  }
}

export function appendScoreLedgerEntry(entry: ScoreLedgerEntry): ScoreLedgerEntry[] {
  const list = loadScoreLedgerEntries();
  const next = [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, 100);
  saveScoreLedgerEntries(next);
  log.info('scoreLedgerEntrySaved', { id: entry.id, owedDescription: entry.owedDescription });
  return next;
}
