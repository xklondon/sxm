import type { GameState } from '../../types';
import {
  shuffleToStartOnState,
  dealCardsButtonOnState,
  hitBlackjackOnState,
  standBlackjackOnState,
  doubleDownBlackjackOnState,
  splitBlackjackOnState,
  takeInsuranceOnState,
  declineInsuranceOnState,
  takeEvenMoneyOnState,
  waitForBlackjackPayoutOnState,
  startNextRoundOnState,
  processPlayFlowAutoStands,
  syncBankPhaseOnState,
  resolveBankTurnAuto,
} from './gameState';

/**
 * Canonical blackjack gameplay actions. These carry rule behavior (phase
 * transitions, dealing, hitting, auto-stand, insurance, settlement, next round)
 * and MUST resolve identically online and offline. Pure table/session ops
 * (assignBox, placeBet, retractChip, clearBet, addGameToPersonalLedger) are not
 * listed here — they mutate seating/stakes/ledger only and are applied directly.
 */
export const BLACKJACK_GAMEPLAY_ACTIONS = [
  'shuffleToStart',
  'dealCards',
  'hit',
  'stand',
  'double',
  'split',
  'takeInsurance',
  'declineInsurance',
  'takeEvenMoney',
  'waitFor3to2',
  'nextRound',
] as const;

export type BlackjackGameplayAction = (typeof BLACKJACK_GAMEPLAY_ACTIONS)[number];

export function isBlackjackGameplayAction(action: string): action is BlackjackGameplayAction {
  return (BLACKJACK_GAMEPLAY_ACTIONS as readonly string[]).includes(action);
}

export interface BlackjackActorContext {
  /** Person performing the action (box caller / table host). */
  personId: string;
  /** Action payload (only insurance/even-money read explicit keys from it). */
  payload: Record<string, unknown>;
  /**
   * When true, the auto bank turn + settlement are played out as part of this
   * action (server-authoritative online). When false, the bank turn is left for
   * the offline timed animation effect. Either way the final settled state is
   * identical.
   */
  resolveBankAuto: boolean;
}

/**
 * Single canonical reducer for blackjack gameplay actions, shared by the online
 * server action layer and (by construction over the same engine functions) the
 * offline local path. Player-turn actions (hit/stand/double/split) ignore any
 * client-supplied handKey and resolve against `state.blackjack.activeHandKey`.
 */
export function applyBlackjackActionToState(
  state: GameState,
  action: BlackjackGameplayAction,
  ctx: BlackjackActorContext,
): GameState {
  let next: GameState;
  switch (action) {
    case 'shuffleToStart':
      next = shuffleToStartOnState(state);
      break;
    case 'dealCards':
      // Auto-stand boxes server-side so the authoritative activeHandKey skips
      // 18+ hands immediately (matches the offline post-deal auto-stand effect).
      next = syncBankPhaseOnState(processPlayFlowAutoStands(dealCardsButtonOnState(state)));
      break;
    case 'hit':
      next = hitBlackjackOnState(state);
      break;
    case 'stand':
      next = standBlackjackOnState(state);
      break;
    case 'double':
      next = doubleDownBlackjackOnState(state);
      break;
    case 'split':
      next = splitBlackjackOnState(state);
      break;
    case 'takeInsurance':
      next = takeInsuranceOnState(state, ctx.payload.playerId as string);
      break;
    case 'declineInsurance':
      next = declineInsuranceOnState(state, ctx.payload.playerId as string);
      break;
    case 'takeEvenMoney':
      next = takeEvenMoneyOnState(state, ctx.payload.handKey as string);
      break;
    case 'waitFor3to2':
      next = waitForBlackjackPayoutOnState(state, ctx.payload.handKey as string);
      break;
    case 'nextRound':
      next = startNextRoundOnState(state);
      break;
    default: {
      const exhaustive: never = action;
      throw new Error(`Unhandled blackjack action: ${String(exhaustive)}`);
    }
  }

  if (ctx.resolveBankAuto) {
    next = resolveBankTurnAuto(next);
  }
  return next;
}
