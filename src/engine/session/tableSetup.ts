import type { GameState } from '../../types';
import type { CardTimerPreset, DealSpeedPreset } from '../blackjack/flowSettings';
import { updateBlackjackFlowSettings } from '../blackjack';
import { setBlackjackProtocolOnState } from '../blackjack/protocolState';
import {
  assignBankBot,
  assignBankPerson,
} from './boxOps';
import { ensureTableOwnerPersonBankroll } from './ownerBankroll';
import { setTableOwner } from './invites';
import {
  confirmTableAgreement,
  DEFAULT_TABLE_CHIPS,
} from './table';
import {
  logDerivedBalances,
  logLedgerAfterAllocation,
  logTableMetaStartingChips,
} from './tokens';

export type TableBankerSetupMode = 'bot' | 'self' | 'other';

export interface TableStakeSetupInput {
  stakeDescription: string;
  seatChips: number;
  bankChips: number;
  bankerMode: TableBankerSetupMode;
  bankerName: string;
  controllerName: string;
  controllerEmail: string;
  protocolId: string;
  naturalDealing: boolean;
  dealSpeedPreset: DealSpeedPreset;
  cardTimerPreset: CardTimerPreset;
  bankDrawAuto: boolean;
}

export function parseTableStakeSetupPayload(
  payload: Record<string, unknown>,
  fallbackController: string,
): TableStakeSetupInput {
  const seatChips = Number(payload.seatChips);
  const bankChips = Number(payload.bankChips);
  const bankerMode = payload.bankerMode as TableBankerSetupMode;
  return {
    stakeDescription: String(payload.stakeDescription ?? 'Friendly game'),
    seatChips: Number.isFinite(seatChips) && seatChips > 0 ? seatChips : DEFAULT_TABLE_CHIPS,
    bankChips: Number.isFinite(bankChips) && bankChips > 0 ? bankChips : DEFAULT_TABLE_CHIPS,
    bankerMode: bankerMode === 'self' || bankerMode === 'other' ? bankerMode : 'bot',
    bankerName: String(payload.bankerName ?? ''),
    controllerName: String(payload.controllerName ?? fallbackController).trim() || fallbackController,
    controllerEmail: String(payload.controllerEmail ?? ''),
    protocolId: String(payload.protocolId ?? 'las-vegas-house'),
    naturalDealing: payload.naturalDealing === true,
    dealSpeedPreset: (payload.dealSpeedPreset as DealSpeedPreset) ?? 'fast',
    cardTimerPreset: (Number(payload.cardTimerPreset) || 0) as CardTimerPreset,
    bankDrawAuto: payload.bankDrawAuto !== false,
  };
}

/** First-time table setup (new table or post–stake-panel confirm). */
export function applyTableStakeSetup(state: GameState, input: TableStakeSetupInput): GameState {
  const seatAmount = input.seatChips;
  const bankAmount = input.bankChips;
  const showPlayingFor = input.bankerMode === 'bot';
  const stakeDescription = showPlayingFor
    ? input.stakeDescription.trim() || 'Friendly wager'
    : 'Table session';

  let next = confirmTableAgreement(state, stakeDescription, seatAmount, bankAmount);

  next = setTableOwner(next, input.controllerName, input.controllerEmail);

  next = {
    ...next,
    tableMeta: {
      ...next.tableMeta,
      controllerName: input.controllerName,
      showBankerSetup: false,
      showStakeSetup: false,
    },
  };

  if (input.bankerMode === 'bot') {
    next = assignBankBot(next, bankAmount);
  } else if (input.bankerMode === 'self') {
    next = assignBankPerson(next, input.controllerName, bankAmount);
  } else {
    next = assignBankPerson(next, input.bankerName.trim(), bankAmount);
  }

  next = ensureTableOwnerPersonBankroll(next);

  logLedgerAfterAllocation(next, 'start-playing');
  logDerivedBalances(next, 'start-playing');
  logTableMetaStartingChips(next, 'start-playing');
  next = setBlackjackProtocolOnState(next, input.protocolId, input.controllerName);
  next = updateBlackjackFlowSettings(next, {
    initialDealMode: input.naturalDealing ? 'natural' : 'staged',
    dealSpeedPreset: input.dealSpeedPreset,
    cardTimerPreset: input.cardTimerPreset,
    countdownSeconds: input.cardTimerPreset,
    bankDrawMode: input.bankDrawAuto ? 'auto' : 'manual',
  });

  return next;
}
