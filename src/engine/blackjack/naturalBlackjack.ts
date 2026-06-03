import type { GameState } from '../../types';
import type { GameSession } from '../../types/session';
import type { Player } from '../../types/player';
import type { Ledger } from '../../types/ledger';
import type { Deck } from '../../types/deck';
import type { BlackjackRound } from '../../types/blackjack';
import { getCardById } from '../deck/deck';
import { appendBoxLedgerEntry } from '../session/boxLedger';
import { appendBankLedgerEntry } from './bankLedger';
import { bankrollContextFromState, type BankrollContext } from '../session/bankroll';
import { cardsFromIds, getBlackjackHandValue } from './hand';
import { getBlackjackProtocolForState } from './protocolState';
import {
  dealerUpRankCanHaveBlackjack,
  getBlackjackPayout,
  shouldOfferEvenMoney,
  shouldPayNaturalImmediately,
} from './protocols/activeRules';
import { findNextActingHand } from './virtual';
import { applySkipBankIfNeeded } from './roundFlow';
import { log } from '../../utils/logger';

export { dealerUpRankCanHaveBlackjack };

function dealerUpRank(deck: Deck, round: BlackjackRound) {
  const upId = round.dealerCardIds.filter(Boolean)[0];
  if (!upId) {
    return undefined;
  }
  return getCardById(deck, upId)?.rank;
}

function payNaturalWin(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  round: BlackjackRound,
  handKey: string,
  bankrollCtx: BankrollContext,
  multiplier: number,
  label: string,
): {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
  round: BlackjackRound;
} {
  const hand = round.playerHands[handKey];
  if (!hand || hand.naturalSettled) {
    return { session, players, ledger, round };
  }

  const bet = hand.currentBet;
  const winnings = Math.floor(bet * multiplier);
  const payout = bet + winnings;
  const message =
    multiplier === 1
      ? `Blackjack! Even money — ${payout} chips`
      : `Blackjack! ${label} — win ${winnings} + bet returned (${payout} chips)`;

  let nextSession = session;
  let nextLedger = ledger;

  const winResult = appendBoxLedgerEntry(
    nextSession,
    nextLedger,
    bankrollCtx,
    hand.playerId,
    'win-paid',
    payout,
    message,
    session.currentRound,
  );
  nextSession = winResult.session;
  nextLedger = winResult.ledger;

  const bankId = session.bankPlayerId;
  if (bankId && winnings > 0) {
    const bankResult = appendBankLedgerEntry(
      nextSession,
      nextLedger,
      bankId,
      -winnings,
      `Natural blackjack payout (${message})`,
      session.currentRound,
    );
    nextSession = bankResult.session;
    nextLedger = bankResult.ledger;
  }

  log.info('naturalBlackjackSettled', { handKey, bet, payout, multiplier });

  return {
    session: nextSession,
    players,
    ledger: nextLedger,
    round: {
      ...round,
      playerHands: {
        ...round.playerHands,
        [handKey]: {
          ...hand,
          actionStatus: 'done',
          naturalSettled: true,
        },
      },
      outcomes: { ...round.outcomes, [handKey]: 'blackjack-win' },
      resultMessages: { ...round.resultMessages, [handKey]: message },
    },
  };
}

/** After initial deal — pay immediate naturals or queue even-money offers. */
export function resolveNaturalsAfterInitialDeal(state: GameState): GameState {
  const round = state.blackjack;
  const deck = state.deck;
  if (!round || !deck || round.status !== 'player-turns') {
    return state;
  }

  const protocol = getBlackjackProtocolForState(state);
  const ctx = bankrollContextFromState(state);
  const upRank = dealerUpRank(deck, round);
  let session = state.session;
  let ledger = state.ledger;
  let nextRound = round;
  let evenMoneyHandKey: string | null = null;

  for (const handKey of Object.keys(nextRound.playerHands)) {
    const hand = nextRound.playerHands[handKey];
    if (!hand || hand.fromSplit || hand.naturalSettled) {
      continue;
    }
    const cards = cardsFromIds(deck, hand.cardIds.filter(Boolean));
    const { isBlackjack } = getBlackjackHandValue(cards);
    if (!isBlackjack) {
      continue;
    }

    if (shouldPayNaturalImmediately(protocol, cards, upRank)) {
      const paid = payNaturalWin(
        session,
        state.players,
        ledger,
        nextRound,
        handKey,
        ctx,
        getBlackjackPayout(protocol),
        protocol.payouts.blackjackLabel,
      );
      session = paid.session;
      ledger = paid.ledger;
      nextRound = paid.round;
      continue;
    }

    if (shouldOfferEvenMoney(protocol, cards, upRank)) {
      evenMoneyHandKey = handKey;
      nextRound = {
        ...nextRound,
        playerHands: {
          ...nextRound.playerHands,
          [handKey]: { ...hand, actionStatus: 'blackjack' },
        },
      };
    }
  }

  if (evenMoneyHandKey) {
    nextRound = {
      ...nextRound,
      evenMoneyOfferHandKey: evenMoneyHandKey,
      activeHandKey: evenMoneyHandKey,
    };
    return { ...state, session, ledger, blackjack: nextRound };
  }

  if (nextRound.insuranceOfferPending) {
    return { ...state, session, ledger, blackjack: nextRound };
  }

  const firstActing = findNextActingHand(session, nextRound);
  nextRound = {
    ...nextRound,
    activeHandKey: firstActing,
    evenMoneyOfferHandKey: null,
  };
  nextRound = applySkipBankIfNeeded(session, nextRound);
  return { ...state, session, ledger, blackjack: nextRound };
}

export function takeEvenMoneyOnState(state: GameState, handKey?: string): GameState {
  const round = state.blackjack;
  if (!round) {
    throw new Error('No active round');
  }
  const key = handKey ?? round.evenMoneyOfferHandKey;
  if (!key) {
    throw new Error('No even-money offer pending');
  }

  const ctx = bankrollContextFromState(state);
  const paid = payNaturalWin(
    state.session,
    state.players,
    state.ledger,
    round,
    key,
    ctx,
    1,
    '1:1',
  );

  let nextRound: BlackjackRound = {
    ...paid.round,
    evenMoneyOfferHandKey: null,
    tookEvenMoney: { ...round.tookEvenMoney, [key]: true },
  };
  const firstActing = findNextActingHand(paid.session, nextRound);
  nextRound = {
    ...nextRound,
    activeHandKey: firstActing,
    status: firstActing ? 'player-turns' : nextRound.status,
  };
  nextRound = applySkipBankIfNeeded(paid.session, nextRound);

  return {
    ...state,
    session: paid.session,
    ledger: paid.ledger,
    blackjack: nextRound,
  };
}

export function waitForBlackjackPayoutOnState(state: GameState, handKey?: string): GameState {
  const round = state.blackjack;
  if (!round) {
    throw new Error('No active round');
  }
  const key = handKey ?? round.evenMoneyOfferHandKey;
  if (!key) {
    throw new Error('No even-money offer pending');
  }

  let nextRound: BlackjackRound = {
    ...round,
    evenMoneyOfferHandKey: null,
    evenMoneyDeclined: { ...round.evenMoneyDeclined, [key]: true },
    playerHands: {
      ...round.playerHands,
      [key]: {
        ...round.playerHands[key]!,
        actionStatus: 'blackjack',
      },
    },
  };

  const firstActing = findNextActingHand(state.session, nextRound);
  nextRound = {
    ...nextRound,
    activeHandKey: firstActing,
    status: firstActing ? 'player-turns' : 'bank-turn',
  };
  nextRound = applySkipBankIfNeeded(state.session, nextRound);

  return { ...state, blackjack: nextRound };
}

/** Resolve pending naturals after dealer peek shows no dealer blackjack. */
export function resolvePendingNaturalsAfterDealerPeek(state: GameState): GameState {
  const round = state.blackjack;
  const deck = state.deck;
  if (!round || !deck) {
    return state;
  }

  const dealerCards = cardsFromIds(deck, round.dealerCardIds.filter(Boolean));
  const { isBlackjack: dealerBj } = getBlackjackHandValue(dealerCards);
  if (dealerBj) {
    return state;
  }

  const protocol = getBlackjackProtocolForState(state);
  const ctx = bankrollContextFromState(state);
  let session = state.session;
  let ledger = state.ledger;
  let nextRound = round;

  for (const handKey of Object.keys(nextRound.playerHands)) {
    const hand = nextRound.playerHands[handKey];
    if (!hand || hand.naturalSettled || hand.fromSplit) {
      continue;
    }
    if (hand.actionStatus !== 'blackjack') {
      continue;
    }
    const cards = cardsFromIds(deck, hand.cardIds.filter(Boolean));
    const { isBlackjack } = getBlackjackHandValue(cards);
    if (!isBlackjack) {
      continue;
    }
    const paid = payNaturalWin(
      session,
      state.players,
      ledger,
      nextRound,
      handKey,
      ctx,
      getBlackjackPayout(protocol),
      protocol.payouts.blackjackLabel,
    );
    session = paid.session;
    ledger = paid.ledger;
    nextRound = paid.round;
  }

  nextRound = applySkipBankIfNeeded(session, nextRound);
  return { ...state, session, ledger, blackjack: nextRound };
}
