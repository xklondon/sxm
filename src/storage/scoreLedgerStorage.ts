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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Games the logged-in user played and chose to save (or participated in). */
export function filterPersonalLedgerEntries(
  entries: ScoreLedgerEntry[],
  viewerEmail: string,
): ScoreLedgerEntry[] {
  const email = normalizeEmail(viewerEmail);
  if (!email) {
    return [];
  }
  return entries.filter((entry) => {
    const saved = entry.savedByEmails?.some((e) => normalizeEmail(e) === email);
    const participant = entry.participantEmails?.some((e) => normalizeEmail(e) === email);
    return Boolean(saved || participant);
  });
}

export type ScoreLedgerPersonFilter = string;
export type ScoreLedgerTableFilter = string;

export function filterScoreLedgerByPerson(
  entries: ScoreLedgerEntry[],
  personQuery: ScoreLedgerPersonFilter,
): ScoreLedgerEntry[] {
  const needle = personQuery.trim().toLowerCase();
  if (!needle) {
    return entries;
  }
  return entries.filter((entry) => {
    if (entry.winnerName.toLowerCase().includes(needle)) {
      return true;
    }
    if (entry.loserName.toLowerCase().includes(needle)) {
      return true;
    }
    if (entry.playersInvolved?.some((name) => name.toLowerCase().includes(needle))) {
      return true;
    }
    if (entry.participantEmails?.some((e) => e.toLowerCase().includes(needle))) {
      return true;
    }
    return false;
  });
}

export function filterScoreLedgerByTable(
  entries: ScoreLedgerEntry[],
  tableQuery: ScoreLedgerTableFilter,
): ScoreLedgerEntry[] {
  const needle = tableQuery.trim().toLowerCase();
  if (!needle) {
    return entries;
  }
  return entries.filter(
    (entry) =>
      entry.tableId.toLowerCase() === needle ||
      (entry.tableName?.toLowerCase().includes(needle) ?? false),
  );
}

export function listScoreLedgerTableOptions(entries: ScoreLedgerEntry[]): string[] {
  const names = new Set<string>();
  for (const entry of entries) {
    if (entry.tableName?.trim()) {
      names.add(entry.tableName.trim());
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function listScoreLedgerPersonOptions(entries: ScoreLedgerEntry[]): string[] {
  const names = new Set<string>();
  for (const entry of entries) {
    if (entry.winnerName.trim()) {
      names.add(entry.winnerName.trim());
    }
    if (entry.loserName.trim() && entry.loserName !== '—') {
      names.add(entry.loserName.trim());
    }
    for (const name of entry.playersInvolved ?? []) {
      if (name.trim()) {
        names.add(name.trim());
      }
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
