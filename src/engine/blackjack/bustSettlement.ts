import type { GameState } from '../../types';
import {
  appendBankLedgerEntryUnlessInternalPot,
  appendBoxLedgerEntryUnlessInternalPot,
} from '../session/sharedPotSettlement';
import { bankrollContextFromState } from '../session/bankroll';
import { applySkipBankIfNeeded } from './roundFlow';
import { log } from '../../utils/logger';

export const BUST_MESSAGE = 'BUST, my friend.';

/**
 * Immediate bust settlement — bank receives the bet once. The busted hand's
 * cards are LEFT IN PLACE (not retracted) so the player can see what they
 * busted on; the hand stays visible with a BUST label until settlement/next
 * round. Only the ledger/outcome state advances here.
 */
export function settleBustHandOnState(state: GameState, handKey: string): GameState {
  const round = state.blackjack;
  if (!round) {
    return state;
  }
  const hand = round.playerHands[handKey];
  if (!hand || hand.actionStatus !== 'busted' || hand.bustSettled) {
    return state;
  }

  const ctx = bankrollContextFromState(state);
  let session = state.session;
  let ledger = state.ledger;
  const bankId = session.bankPlayerId;
  const bet = hand.currentBet;

  const lossResult = appendBoxLedgerEntryUnlessInternalPot(
    session,
    ledger,
    ctx,
    hand.playerId,
    'loss-collected',
    0,
    BUST_MESSAGE,
    session.currentRound,
    bet,
  );
  session = lossResult.session;
  ledger = lossResult.ledger;

  if (bankId && bet > 0) {
    const bankResult = appendBankLedgerEntryUnlessInternalPot(
      session,
      ledger,
      ctx,
      hand.playerId,
      bankId,
      bet,
      `Bust — bank takes ${bet}`,
      session.currentRound,
    );
    session = bankResult.session;
    ledger = bankResult.ledger;
  }

  log.info('bustSettledImmediate', {
    handKey,
    boxPlayerId: hand.playerId,
    bet,
    bankId,
  });

  const playerHands = {
    ...round.playerHands,
    [handKey]: {
      ...hand,
      bustSettled: true,
    },
  };

  return {
    ...state,
    session,
    ledger,
    blackjack: applySkipBankIfNeeded(session, {
      ...round,
      playerHands,
      outcomes: { ...round.outcomes, [handKey]: 'loss' },
      resultMessages: { ...round.resultMessages, [handKey]: BUST_MESSAGE },
    }),
  };
}
