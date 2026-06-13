/**
 * Accounting display boundary — one canonical projection for tray + This Table.
 * Ledger mechanics stay in engine/bankroll; views only read through here.
 */
import type { GameState } from '../types';
import { clampAvailableForDisplay } from './displayBalance';
import {
  getAvailableChipsForBankrollOwner,
  getTotalBettingExposureForBankrollOwner,
} from '../engine/session/bankroll';

export interface PersonDisplayBalances {
  available: number;
  betting: number;
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

/** Files that must use resolvePersonDisplayBalances / resolveViewerTrayAvailable for player amounts. */
export const ACCOUNTING_DISPLAY_VIEW_FILES = [
  'src/components/tableInfoDisplay.ts',
  'src/engine/session/tablePeople.ts',
] as const;
