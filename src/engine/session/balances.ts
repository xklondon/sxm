import type { GameState } from '../../types';
import { getStakeForBox, isBettingOpen } from '../blackjack/stakes';
import { listHandKeysForPlayer } from '../blackjack/handKeys';
import {
  getAvailableChipsForBankrollOwner,
  getBoxSlotNumbersForBankrollOwner,
  getLedgerBalanceForBankrollOwner,
  getTotalBettingExposureForBankrollOwner,
  listBankrollParticipantIds,
  logAccountsPanelPeopleBalances,
  resolveBankrollOwnerIdForBox,
} from './bankroll';

/** @deprecated Use bankroll owner helpers — box positions do not hold ledger balances. */
export function getLedgerBalance(state: GameState, participantId: string): number {
  return getLedgerBalanceForBankrollOwner(state, participantId);
}

/** Open-table stake for a box position (not deducted from ledger until deal). */
export function getOpenTableStake(state: GameState, boxPlayerId: string): number {
  if (boxPlayerId === state.session.bankPlayerId) {
    return 0;
  }
  if (isBettingOpen(state) && !state.tableMeta.bettingLocked) {
    return getStakeForBox(state, boxPlayerId);
  }
  return 0;
}

/** Confirmed/in-round bet total for a box position (split hands summed). */
export function getConfirmedBetTotal(state: GameState, boxPlayerId: string): number {
  if (boxPlayerId === state.session.bankPlayerId) {
    return 0;
  }

  const openStake = getOpenTableStake(state, boxPlayerId);
  if (openStake > 0) {
    return openStake;
  }

  const round = state.blackjack;
  if (!round) {
    return 0;
  }

  return listHandKeysForPlayer(round.playerHands, boxPlayerId).reduce(
    (sum, key) => sum + (round.playerHands[key]?.currentBet ?? 0),
    0,
  );
}

/** Spendable chips for a person/bank bankroll minus all box exposure. */
export function getAvailableChips(state: GameState, bankrollOwnerId: string): number {
  return getAvailableChipsForBankrollOwner(state, bankrollOwnerId);
}

export interface AccountRow {
  participantId: string;
  kind: 'bank' | 'person';
  label: string;
  displayName: string;
  ledgerBalance: number;
  available: number;
  currentBet: number;
  boxSlots: number[];
}

export function buildAccountRows(state: GameState): AccountRow[] {
  const rows: AccountRow[] = [];
  const bankId = state.session.bankPlayerId;

  if (bankId && state.players[bankId]) {
    const bank = state.players[bankId];
    rows.push({
      participantId: bankId,
      kind: 'bank',
      label: 'BANK',
      displayName: bank.displayName,
      ledgerBalance: getLedgerBalanceForBankrollOwner(state, bankId),
      available: getAvailableChipsForBankrollOwner(state, bankId),
      currentBet: 0,
      boxSlots: [],
    });
  }

  const personIds = listBankrollParticipantIds(state).filter((id) => id !== bankId);

  for (const personId of personIds) {
    const person = state.players[personId];
    if (!person) {
      continue;
    }
    const boxSlots = getBoxSlotNumbersForBankrollOwner(state, personId);
    if (boxSlots.length === 0 && person.role === 'box') {
      continue;
    }
    rows.push({
      participantId: personId,
      kind: 'person',
      label: person.controllerName || person.displayName,
      displayName: person.displayName,
      ledgerBalance: getLedgerBalanceForBankrollOwner(state, personId),
      available: getAvailableChipsForBankrollOwner(state, personId),
      currentBet: getTotalBettingExposureForBankrollOwner(state, personId),
      boxSlots,
    });
  }

  logAccountsPanelPeopleBalances(
    rows.map((r) => ({
      label: r.label,
      bankrollOwnerId: r.participantId,
      available: r.available,
      betting: r.currentBet,
      boxSlots: r.boxSlots,
    })),
  );

  return rows;
}

export { getStakeForBox, resolveBankrollOwnerIdForBox };
