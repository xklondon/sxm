import type { GameState } from '../../types';
import { log } from '../../utils/logger';
import { DEFAULT_TABLE_CHIPS } from './table';
import {
  allocateChipsToBankrollOwner,
  type AllocationReason,
  logDerivedBalances,
  logLedgerAfterAllocation,
} from './allocation';
import { listPersonBankrollOwnerIds } from './bankroll';

export type ChipAssignReason = 'starting-allocation' | 'top-up' | 'adjustment';

export const ALL_BOXES_RECIPIENT = '__all_boxes__';

export function isTableOwner(state: GameState, personName: string): boolean {
  const owner = state.tableMeta.owner?.ownerName?.trim();
  if (!owner) {
    return false;
  }
  return owner === personName.trim();
}

export function getStartingChipsEachSeat(state: GameState): number {
  const seat = state.tableMeta.startingChipsEachSeat;
  if (typeof seat === 'number' && seat > 0) {
    return seat;
  }
  const agreed = state.tableMeta.agreement?.defaultChips;
  if (typeof agreed === 'number' && agreed > 0) {
    return agreed;
  }
  return DEFAULT_TABLE_CHIPS;
}

export function getStartingChipsBank(state: GameState): number {
  const bank = state.tableMeta.startingChipsBank;
  if (typeof bank === 'number' && bank > 0) {
    return bank;
  }
  return getStartingChipsEachSeat(state);
}

export function logTableMetaStartingChips(state: GameState, context: string): void {
  log.info('tableMetaStartingChips', {
    context,
    startingChipsEachSeat: state.tableMeta.startingChipsEachSeat,
    startingChipsBank: state.tableMeta.startingChipsBank,
    resolvedSeat: getStartingChipsEachSeat(state),
    resolvedBank: getStartingChipsBank(state),
    agreementDefault: state.tableMeta.agreement?.defaultChips,
  });
}

function mapAssignReason(reason: ChipAssignReason): AllocationReason {
  switch (reason) {
    case 'adjustment':
      return 'adjustment';
    case 'starting-allocation':
    case 'top-up':
    default:
      return 'owner-top-up';
  }
}

/** Assign chips to bank or person bankroll (not box positions). */
export function assignChips(
  state: GameState,
  recipientId: string,
  amount: number,
  reason: ChipAssignReason,
  note?: string,
): GameState {
  log.info('assignChips request', { recipientId, amount, reason });

  const allocationReason = mapAssignReason(reason);

  if (recipientId === ALL_BOXES_RECIPIENT) {
    const personIds = listPersonBankrollOwnerIds(state);
    if (personIds.length === 0) {
      throw new Error('No person bankrolls to assign chips to');
    }
    let next = state;
    for (const id of personIds) {
      next = allocateChipsToBankrollOwner(next, {
        bankrollOwnerId: id,
        amount,
        reason: allocationReason,
        note,
        source: 'assign-modal',
      });
    }
    logLedgerAfterAllocation(next, 'assignChips-all-persons');
    logDerivedBalances(next, 'assignChips-all-persons');
    return next;
  }

  const next = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: recipientId,
    amount,
    reason: allocationReason,
    note,
    source: 'assign-modal',
  });
  logLedgerAfterAllocation(next, 'assignChips');
  logDerivedBalances(next, 'assignChips');
  return next;
}

/** @deprecated Use assignChips or allocateChipsToBankrollOwner */
export function assignChipsToPlayer(
  state: GameState,
  playerId: string,
  amount: number,
  reason: ChipAssignReason = 'top-up',
  note?: string,
): GameState {
  return assignChips(state, playerId, amount, reason, note);
}

/** @deprecated Use assignChips */
export function assignTokensToPlayer(
  state: GameState,
  playerId: string,
  amount: number,
  note?: string,
): GameState {
  return assignChips(state, playerId, amount, 'top-up', note);
}

export function logSetupValues(
  stakeDescription: string,
  startingChipsEachSeat: number,
  startingChipsBank: number,
): void {
  log.info('setupValues', {
    stakeDescription,
    startingChipsEachSeat,
    startingChipsBank,
  });
}

export {
  allocateChipsToParticipant,
  allocateChipsToBankrollOwner,
  createParticipantWithAllocation,
  logLedgerAfterAllocation,
  logDerivedBalances,
  logAccountPanelBalances,
} from './allocation';

export type { AllocationReason, AllocationSource, AllocateChipsInput } from './allocation';

export { buildAccountRows, getAvailableChips, getLedgerBalance, getConfirmedBetTotal } from './balances';
