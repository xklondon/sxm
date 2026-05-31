import type { GameState } from '../../types';
import { appendBoxLedgerEntry } from '../session/boxLedger';
import { appendBankLedgerEntry } from './bankLedger';
import { bankrollContextFromState } from '../session/bankroll';
import { applySkipBankIfNeeded } from './roundFlow';
import { log } from '../../utils/logger';

export const BUST_MESSAGE = 'BUST, my friend.';

/** Immediate bust settlement — bank receives bet once; cards retracted from display. */
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

  const lossResult = appendBoxLedgerEntry(
    session,
    ledger,
    ctx,
    hand.playerId,
    'loss-collected',
    0,
    BUST_MESSAGE,
    session.currentRound,
  );
  session = lossResult.session;
  ledger = lossResult.ledger;

  if (bankId && bet > 0) {
    const bankResult = appendBankLedgerEntry(
      session,
      ledger,
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
      cardIds: [],
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
