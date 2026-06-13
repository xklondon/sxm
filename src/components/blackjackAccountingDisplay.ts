/**
 * Accounting display boundary — one canonical projection for tray + This Table.
 * Ledger mechanics stay in engine/bankroll; views only read through here.
 */
import type { GameState } from '../types';
import { clampAvailableForDisplay } from './displayBalance';
import {
  getAvailableChipsForBankrollOwner,
  getLedgerBalanceForBankrollOwner,
  getTotalBettingExposureForBankrollOwner,
} from '../engine/session/bankroll';

export interface PersonDisplayBalances {
  available: number;
  betting: number;
}

export interface PersonEndGameBalances extends PersonDisplayBalances {
  ledger: number;
}

/** Canonical tray + This Table numbers for one seated person. */
export function resolvePersonDisplayBalances(
  state: GameState,
  personId: string,
): PersonDisplayBalances {
  const rawAvailable = getAvailableChipsForBankrollOwner(state, personId);
  return {
    available: clampAvailableForDisplay(rawAvailable) ?? 0,
    betting: getTotalBettingExposureForBankrollOwner(state, personId),
  };
}

/** End-game eligibility uses the same projection as tray + This Table. */
export function resolvePersonEndGameBalances(
  state: GameState,
  personId: string,
): PersonEndGameBalances {
  const display = resolvePersonDisplayBalances(state, personId);
  return {
    ...display,
    ledger: getLedgerBalanceForBankrollOwner(state, personId),
  };
}

/** Tray info bar projection for the active viewer. */
export function resolveViewerTrayAvailable(
  state: GameState,
  viewerPersonId: string | null,
): number | null {
  if (viewerPersonId === null) {
    return null;
  }
  return clampAvailableForDisplay(getAvailableChipsForBankrollOwner(state, viewerPersonId));
}

export { getTotalCommittedExposureForPerson } from '../engine/session/playerCommittedExposure';
export {
  personsShareOneChipPot,
  resolveCanonicalBankrollOwnerId,
  usesSharedBankPlayerPot,
} from '../engine/session/sharedBankroll';

/** Files that must use resolvePersonDisplayBalances / resolveViewerTrayAvailable for player amounts. */
export const ACCOUNTING_DISPLAY_VIEW_FILES = [
  'src/components/tableInfoDisplay.ts',
  'src/engine/session/tablePeople.ts',
] as const;

/** Files that must use resolvePersonEndGameBalances for end-game bankroll checks. */
export const ACCOUNTING_END_GAME_FILES = ['src/engine/session/tableGameEnd.ts'] as const;
