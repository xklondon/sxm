import type { GameState } from '../../types';
import type { BoxStakeEntry, StakeChipEntry } from '../../types/table';
import { log } from '../../utils/logger';
import { getTableMinimumBet } from './dealEligibility';
import { getAvailableChipsForBankrollOwner, resolveBankrollOwnerIdForBox } from '../session/bankroll';
import {
  assertStakePayerInvariant,
  reconstructStakerAmountsFromChipEntries,
  StakePayerInvariantError,
} from './stakePayerInvariant';
import { assignTemporaryBoxOwnerOnFirstBet } from '../session/boxDecisionOwnership';
import {
  resolveControllerPersonId,
} from '../session/playerAssignment';
import { resetBlackjackRoundOwnership } from '../session/resetBlackjackRoundOwnership';
import { formatInsufficientChipsMessage } from './playFlow';
import { getBlackjackProtocolForState } from './protocolState';
import {
  formatMinBetMultipleMessage,
  isBetValidUnderProtocol,
} from './protocols/activeRules';

export type StakeChipValue = 1 | 2 | 5 | 10 | 20 | 50;

function occupiedBoxIds(state: GameState): string[] {
  return state.tableMeta.boxSlots
    .map((s) => s.playerId)
    .filter((id): id is string => id !== null);
}

/** Single source of truth: stake amount for a box. */
export function getStakeForBox(state: GameState, boxPlayerId: string): number {
  return state.tableMeta.boxStakes[boxPlayerId]?.amount ?? 0;
}

export interface BoxStakeContributor {
  personId: string;
  amount: number;
}

/** Per-player stake on a box — canonical breakdown for display and settlement audit. */
export function getBoxStakeBreakdown(state: GameState, boxPlayerId: string): BoxStakeContributor[] {
  const amounts = resolveStakerAmountsByPersonId(state, boxPlayerId);
  return Object.entries(amounts)
    .filter(([, amount]) => amount > 0)
    .map(([personId, amount]) => ({ personId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Betting label — one amount or per-contributor amounts (never a misleading single payer total). */
export function formatBoxStakeDisplayLabel(state: GameState, boxPlayerId: string): string {
  const breakdown = getBoxStakeBreakdown(state, boxPlayerId);
  if (breakdown.length === 0) {
    return '';
  }
  if (breakdown.length === 1) {
    return String(breakdown[0]!.amount);
  }
  return breakdown
    .map(({ personId, amount }) => {
      const person = state.players[personId];
      const label = (person?.controllerName?.trim() || person?.displayName || '?').slice(0, 3);
      return `${label}:${amount}`;
    })
    .join(' ');
}

export function getStakeChipEntriesForBox(
  state: GameState,
  boxPlayerId: string,
): StakeChipEntry[] {
  const entry = state.tableMeta.boxStakes[boxPlayerId];
  if (!entry) {
    return [];
  }
  if (entry.chipEntries && entry.chipEntries.length > 0) {
    return [...entry.chipEntries];
  }
  if (entry.amount > 0) {
    throw new StakePayerInvariantError(
      `Box ${boxPlayerId} missing chipEntries for open stake amount ${entry.amount}`,
    );
  }
  return [];
}

export function getStakeChipsForBox(state: GameState, boxPlayerId: string): StakeChipValue[] {
  return getStakeChipEntriesForBox(state, boxPlayerId).map(
    (chip) => chip.value as StakeChipValue,
  );
}

export { StakePayerInvariantError } from './stakePayerInvariant';

/**
 * Resolve per-staker amounts — canonical: stakerAmountsByPersonId or chipEntries reconstruction only.
 * Never guesses payer from caller, native owner, or stakerPersonIds.
 */
export function resolveStakerAmountsByPersonId(
  state: GameState,
  boxPlayerId: string,
  entry?: BoxStakeEntry | null,
): Record<string, number> {
  const stake = entry ?? state.tableMeta.boxStakes[boxPlayerId];
  if (!stake || stake.amount <= 0) {
    return {};
  }

  const fromMap = stake.stakerAmountsByPersonId;
  if (fromMap && Object.keys(fromMap).length > 0) {
    return assertStakePayerInvariant(boxPlayerId, stake, fromMap);
  }

  if (stake.chipEntries && stake.chipEntries.length > 0) {
    return reconstructStakerAmountsFromChipEntries(boxPlayerId, stake);
  }

  throw new StakePayerInvariantError(
    `Box ${boxPlayerId} has stake amount ${stake.amount} but no stakerAmountsByPersonId or chipEntries`,
  );
}

export function getStakerAmountForPersonOnBox(
  state: GameState,
  boxPlayerId: string,
  personId: string,
): number {
  return resolveStakerAmountsByPersonId(state, boxPlayerId)[personId] ?? 0;
}

export function getBoxesWithStakes(state: GameState): string[] {
  const ids = new Set<string>();
  for (const id of occupiedBoxIds(state)) {
    if (getStakeForBox(state, id) > 0) {
      ids.add(id);
    }
  }
  for (const boxId of Object.keys(state.tableMeta.boxStakes)) {
    if (getStakeForBox(state, boxId) > 0) {
      ids.add(boxId);
    }
  }
  return [...ids];
}

export function hasAnyStakes(state: GameState): boolean {
  return getBoxesWithStakes(state).length > 0;
}

export function isBettingOpen(state: GameState): boolean {
  return !state.tableMeta.bettingLocked;
}

function resolveStakerPersonId(
  state: GameState,
  boxPlayerId: string,
  stakerPersonId?: string,
): string {
  if (stakerPersonId) {
    return stakerPersonId;
  }
  const controller = state.tableMeta.controllerName.trim();
  if (controller) {
    const byController = resolveControllerPersonId(state, controller);
    if (byController) {
      return byController;
    }
  }
  return resolveBankrollOwnerIdForBox(state, boxPlayerId);
}

function pruneStakerAmounts(amounts: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [personId, amount] of Object.entries(amounts)) {
    if (amount > 0) {
      next[personId] = amount;
    }
  }
  return next;
}

export function addChipToBoxStake(
  state: GameState,
  boxPlayerId: string,
  chip: StakeChipValue,
  stakerPersonId?: string,
): GameState {
  if (state.tableMeta.bettingLocked) {
    throw new Error('Bets are locked for this round.');
  }
  const bettorId = resolveStakerPersonId(state, boxPlayerId, stakerPersonId);
  const available = getAvailableChipsForBankrollOwner(state, bettorId);
  if (chip > available) {
    throw new Error(formatInsufficientChipsMessage(available, chip));
  }
  const entry: BoxStakeEntry = state.tableMeta.boxStakes[boxPlayerId] ?? { amount: 0, chips: [] };
  const priorAmounts =
    entry.amount > 0
      ? resolveStakerAmountsByPersonId(state, boxPlayerId, entry)
      : {};
  const chipEntries = [
    ...(entry.amount > 0 ? getStakeChipEntriesForBox(state, boxPlayerId) : []),
    { value: chip, payerPersonId: bettorId },
  ];
  const newAmount = entry.amount + chip;
  const minBet = getTableMinimumBet(state);
  const protocol = getBlackjackProtocolForState(state);
  const validation = isBetValidUnderProtocol(protocol, newAmount, minBet);
  const callerPersonId = assignTemporaryBoxOwnerOnFirstBet(state, boxPlayerId, bettorId, entry);
  const stakerAmountsByPersonId = pruneStakerAmounts({
    ...priorAmounts,
    [bettorId]: (priorAmounts[bettorId] ?? 0) + chip,
  });
  assertStakePayerInvariant(boxPlayerId, { ...entry, amount: newAmount }, stakerAmountsByPersonId);
  const stakerPersonIds = Object.keys(stakerAmountsByPersonId);
  log.info('Stake chip added', {
    boxId: boxPlayerId,
    chip,
    total: newAmount,
    minBet,
    callerPersonId,
    stakerPersonId: bettorId,
    stakerAmountsByPersonId,
  });
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {
        ...state.tableMeta.boxStakes,
        [boxPlayerId]: {
          amount: newAmount,
          chips: chipEntries.map((c) => c.value),
          chipEntries,
          confirmed: validation.valid,
          callerPersonId,
          stakerPersonIds,
          stakerAmountsByPersonId,
        },
      },
    },
  };
}

/** Confirm open-table stake — rejected when below table minimum bet. */
export function confirmBoxStake(state: GameState, boxPlayerId: string): GameState {
  if (state.tableMeta.bettingLocked) {
    throw new Error('Bets are locked for this round.');
  }
  const entry = state.tableMeta.boxStakes[boxPlayerId];
  const amount = entry?.amount ?? 0;
  if (amount <= 0) {
    throw new Error('Place chips first.');
  }
  const minBet = getTableMinimumBet(state);
  const protocol = getBlackjackProtocolForState(state);
  const validation = isBetValidUnderProtocol(protocol, amount, minBet);
  if (!validation.valid) {
    throw new Error(validation.reason ?? formatMinBetMultipleMessage(minBet));
  }
  log.info('confirmBet', { boxId: boxPlayerId, amount, minBet });
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {
        ...state.tableMeta.boxStakes,
        [boxPlayerId]: { ...entry!, confirmed: true },
      },
    },
  };
}

export function isBoxStakeConfirmed(state: GameState, boxPlayerId: string): boolean {
  const entry = state.tableMeta.boxStakes[boxPlayerId];
  if (!entry || entry.amount <= 0) {
    return false;
  }
  const minBet = getTableMinimumBet(state);
  const protocol = getBlackjackProtocolForState(state);
  if (!isBetValidUnderProtocol(protocol, entry.amount, minBet).valid) {
    return false;
  }
  if (entry.confirmed === true) {
    return true;
  }
  return entry.amount >= minBet;
}

/** Validation message for open-table stake on a box (null when valid or empty). */
export function getStakeBetValidationMessage(state: GameState, boxPlayerId: string): string | null {
  const entry = state.tableMeta.boxStakes[boxPlayerId];
  const amount = entry?.amount ?? 0;
  if (amount <= 0) {
    return null;
  }
  const minBet = getTableMinimumBet(state);
  const protocol = getBlackjackProtocolForState(state);
  const validation = isBetValidUnderProtocol(protocol, amount, minBet);
  return validation.valid ? null : (validation.reason ?? formatMinBetMultipleMessage(minBet));
}

export function removeLastChipFromBoxStake(state: GameState, boxPlayerId: string): GameState {
  if (state.tableMeta.bettingLocked) {
    throw new Error('Bets are locked for this round.');
  }
  const entry = state.tableMeta.boxStakes[boxPlayerId];
  const chipEntries = entry ? getStakeChipEntriesForBox(state, boxPlayerId) : [];
  if (!entry || chipEntries.length === 0) {
    return clearBoxStake(state, boxPlayerId);
  }

  const chips = [...chipEntries];
  const removedChip = chips.pop()!;
  const removed = removedChip.value;
  const payerId = removedChip.payerPersonId;
  const newAmount = entry.amount - removed;
  const minBet = getTableMinimumBet(state);
  const protocol = getBlackjackProtocolForState(state);
  const validation = isBetValidUnderProtocol(protocol, newAmount, minBet);

  const nextAmounts = pruneStakerAmounts({
    ...resolveStakerAmountsByPersonId(state, boxPlayerId, entry),
    [payerId]: (resolveStakerAmountsByPersonId(state, boxPlayerId, entry)[payerId] ?? 0) - removed,
  });
  const stakerPersonIds = Object.keys(nextAmounts);

  log.info('Stake chip removed', {
    boxId: boxPlayerId,
    removed,
    payerId,
    total: newAmount,
    stakerPersonIds,
  });

  if (newAmount <= 0) {
    return clearBoxStake(state, boxPlayerId);
  }

  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {
        ...state.tableMeta.boxStakes,
        [boxPlayerId]: {
          ...entry,
          amount: newAmount,
          chips: chips.map((c) => c.value),
          chipEntries: chips,
          confirmed: validation.valid,
          stakerPersonIds,
          stakerAmountsByPersonId: nextAmounts,
        },
      },
    },
  };
}

export function clearBoxStake(state: GameState, boxPlayerId: string): GameState {
  if (state.tableMeta.bettingLocked) {
    throw new Error('Bets are locked for this round.');
  }
  const entry = state.tableMeta.boxStakes[boxPlayerId];
  if (entry && entry.amount > 0) {
    log.info('Stake cleared (betting phase refund)', {
      boxId: boxPlayerId,
      amount: entry.amount,
    });
  }
  const nextStakes = { ...state.tableMeta.boxStakes };
  delete nextStakes[boxPlayerId];
  return {
    ...state,
    tableMeta: { ...state.tableMeta, boxStakes: nextStakes },
  };
}

/** @deprecated Use startNextRoundOnState — ownership reset only. */
export function unlockBettingForNextRound(state: GameState): GameState {
  return resetBlackjackRoundOwnership(state);
}
