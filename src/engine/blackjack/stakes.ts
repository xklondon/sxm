import type { GameState } from '../../types';
import type { BoxStakeEntry } from '../../types/table';
import { log } from '../../utils/logger';
import { getTableMinimumBet } from './dealEligibility';
import {
  getAvailableChipsForBankrollOwner,
  resolveBankrollOwnerIdForBox,
} from '../session/bankroll';
import { assignTemporaryBoxOwnerOnFirstBet } from '../session/boxDecisionOwnership';
import {
  resolveControllerPersonId,
} from '../session/playerAssignment';
import { formatInsufficientChipsMessage } from './playFlow';
import { getBlackjackProtocolForState } from './protocolState';
import {
  formatMinBetMultipleMessage,
  isBetValidUnderProtocol,
} from './protocols/activeRules';

export type StakeChipValue = 1 | 2 | 5 | 10 | 50;

function occupiedBoxIds(state: GameState): string[] {
  return state.tableMeta.boxSlots
    .map((s) => s.playerId)
    .filter((id): id is string => id !== null);
}

/** Single source of truth: stake amount for a box. */
export function getStakeForBox(state: GameState, boxPlayerId: string): number {
  return state.tableMeta.boxStakes[boxPlayerId]?.amount ?? 0;
}

export function getStakeChipsForBox(state: GameState, boxPlayerId: string): StakeChipValue[] {
  return (state.tableMeta.boxStakes[boxPlayerId]?.chips ?? []) as StakeChipValue[];
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
  const newAmount = entry.amount + chip;
  const minBet = getTableMinimumBet(state);
  const protocol = getBlackjackProtocolForState(state);
  const validation = isBetValidUnderProtocol(protocol, newAmount, minBet);
  const callerPersonId = assignTemporaryBoxOwnerOnFirstBet(state, boxPlayerId, bettorId, entry);
  const stakerPersonIds = [...new Set([...(entry.stakerPersonIds ?? []), bettorId])];
  log.info('Stake chip added', {
    boxId: boxPlayerId,
    chip,
    total: newAmount,
    minBet,
    callerPersonId,
    stakerPersonId: bettorId,
  });
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {
        ...state.tableMeta.boxStakes,
        [boxPlayerId]: {
          amount: newAmount,
          chips: [...entry.chips, chip],
          confirmed: validation.valid,
          callerPersonId,
          stakerPersonIds,
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
  if (!entry || entry.chips.length === 0) {
    return clearBoxStake(state, boxPlayerId);
  }
  const chips = [...entry.chips];
  const removed = chips.pop()!;
  const newAmount = entry.amount - removed;
  const minBet = getTableMinimumBet(state);
  const protocol = getBlackjackProtocolForState(state);
  const validation = isBetValidUnderProtocol(protocol, newAmount, minBet);
  log.info('Stake chip removed', { boxId: boxPlayerId, removed, total: newAmount });
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
          chips,
          confirmed: validation.valid,
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

export function unlockBettingForNextRound(state: GameState): GameState {
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {},
      bettingLocked: false,
    },
  };
}
