import type { GameSession } from '../../types/session';
import type { Player } from '../../types/player';
import type { Ledger } from '../../types/ledger';
import type { Card, Deck } from '../../types/deck';
import type {
  BlackjackOutcome,
  BlackjackRound,
} from '../../types/blackjack';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import {
  bankrollContextFromState,
  resolveBankrollOwnerId,
  type BankrollContext,
} from '../session/bankroll';
import { appendBoxLedgerEntry } from '../session/boxLedger';
import { appendBankLedgerEntry } from './bankLedger';
import { drawCard, getCardById } from '../deck/deck';
import { applyDeckToGameState } from '../deck/gameState';
import type { GameState } from '../../types';
import { getBlackjackHandStatus, getBlackjackHandValue } from './hand';
import { shouldDealerDraw } from './dealerDraw';
import type { BlackjackSettings } from './settings';
import { settleInsuranceBets } from './insurance';
import {
  blackjackHandKey,
  listHandKeysForPlayer,
  parseBlackjackHandKey,
} from './handKeys';
import {
  assertHandCanAct,
  assertRoundStatus,
  createInitialBlackjackRound,
  dealerNeedsCards,
  getBettingPlayerIds,
  orderedHandKeys,
  resetPlayerRoundFields,
  syncActivePlayerId,
  syncPlayerBetsFromRound,
  validateBetAmount,
} from './helpers';
import { findNextActingHand } from './virtual';
import { applySkipBankIfNeeded, shouldSkipBankDraw } from './roundFlow';
import { dealInitialBlackjackCardsFast } from './initialDeal';
import type { BlackjackProtocol } from './protocols/types';
import { getBlackjackProtocolOrDefault } from './protocols';
import {
  buildActiveRulesHandContext,
  canDoubleUnderProtocol,
  canSplitUnderProtocol,
} from './protocols/activeRules';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';

export interface BlackjackEngineState {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
  deck: Deck;
  round: BlackjackRound;
}

function bettingPlayers(session: GameSession): string[] {
  return getBettingPlayerIds(session);
}

function cardsFromIds(deck: Deck, ids: string[]): Card[] {
  return ids
    .map((id) => getCardById(deck, id))
    .filter((card): card is Card => card !== undefined);
}

function setHandStatusAfterHit(
  round: BlackjackRound,
  handKey: string,
  deck: Deck,
): BlackjackRound {
  const hand = round.playerHands[handKey];
  if (!hand) {
    throw new Error(`Hand ${handKey} not found`);
  }

  const cards = cardsFromIds(deck, hand.cardIds);
  const status = getBlackjackHandStatus(cards);

  let actionStatus = hand.actionStatus;
  if (status === 'busted') {
    actionStatus = 'busted';
  } else if (hand.doubled) {
    actionStatus = 'stood';
  }

  return {
    ...round,
    playerHands: {
      ...round.playerHands,
      [handKey]: {
        ...hand,
        actionStatus,
      },
    },
  };
}

function advanceToNextHand(
  session: GameSession,
  round: BlackjackRound,
  currentHandKey?: string,
): BlackjackRound {
  const nextHandKey = findNextActingHand(session, round, currentHandKey);
  if (nextHandKey) {
    return syncActivePlayerId({
      ...round,
      activeHandKey: nextHandKey,
      status: 'player-turns',
    });
  }

  const firstActingHand = findNextActingHand(session, round);
  if (firstActingHand) {
    return syncActivePlayerId({
      ...round,
      activeHandKey: firstActingHand,
      status: 'player-turns',
    });
  }

  return applySkipBankIfNeeded(
    session,
    syncActivePlayerId({
      ...round,
      activeHandKey: null,
      status: 'bank-turn',
      dealerHoleHidden: false,
    }),
  );
}

export function createBlackjackRound(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck | null,
): { session: GameSession; players: Record<string, Player>; deck: Deck; round: BlackjackRound } {
  if (session.gameType !== 'blackjack') {
    throw new Error('Session is not a Blackjack game');
  }
  if (!session.bankPlayerId) {
    throw new Error('Bank/dealer must be assigned');
  }
  if (bettingPlayers(session).length === 0) {
    throw new Error('At least one non-dealer player is required');
  }
  if (!deck) {
    throw new Error('Deck must be shuffled before starting a round');
  }

  const round = createInitialBlackjackRound(session);
  return {
    session,
    players: resetPlayerRoundFields(players),
    deck,
    round,
  };
}

export function placeBlackjackBet(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  round: BlackjackRound,
  playerId: string,
  amount: number,
  bankrollCtx: BankrollContext,
  settings?: BlackjackSettings,
): { session: GameSession; players: Record<string, Player>; ledger: Ledger; round: BlackjackRound } {
  assertRoundStatus(round, ['betting'], 'place bet');
  if (!bettingPlayers(session).includes(playerId)) {
    throw new Error('Dealer cannot place a bet');
  }

  const bankrollOwnerId = resolveBankrollOwnerId(bankrollCtx, playerId);
  validateBetAmount(ledger, bankrollOwnerId, amount, settings);

  let nextSession = session;
  let nextLedger = ledger;
  const primaryHandKey = blackjackHandKey(playerId, 0);
  const existingHand = round.playerHands[primaryHandKey] ?? createBlackjackPlayerHand(playerId, 0);
  const previousBet = existingHand.currentBet ?? 0;

  if (previousBet > 0) {
    const refund = appendBoxLedgerEntry(
      nextSession,
      nextLedger,
      bankrollCtx,
      playerId,
      'push-refund',
      previousBet,
      `Bet cleared before new bet (${previousBet} chips returned)`,
    );
    nextSession = refund.session;
    nextLedger = refund.ledger;
  }

  const bet = appendBoxLedgerEntry(
    nextSession,
    nextLedger,
    bankrollCtx,
    playerId,
    'bet-placed',
    -amount,
    `Blackjack bet: ${amount} chips`,
  );

  const nextRound: BlackjackRound = {
    ...round,
    playerHands: {
      ...round.playerHands,
      [primaryHandKey]: {
        ...existingHand,
        currentBet: amount,
        actionStatus: 'betting',
      },
    },
  };

  return {
    session: bet.session,
    players: syncPlayerBetsFromRound(players, nextRound),
    ledger: bet.ledger,
    round: nextRound,
  };
}

export function dealInitialBlackjackCards(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck,
  round: BlackjackRound,
): {
  session: GameSession;
  players: Record<string, Player>;
  deck: Deck;
  round: BlackjackRound;
} {
  return dealInitialBlackjackCardsFast(session, players, deck, round);
}

export function hitBlackjackPlayer(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck,
  round: BlackjackRound,
  handKey: string,
): { session: GameSession; players: Record<string, Player>; deck: Deck; round: BlackjackRound } {
  assertRoundStatus(round, ['player-turns'], 'hit');
  const hand = assertHandCanAct(round, handKey, 'hit');

  if (hand.doubled) {
    throw new Error('Cannot hit after doubling down');
  }

  const draw = drawCard(deck);
  if (!draw.card) {
    throw new Error('No cards remaining in deck');
  }

  let nextRound: BlackjackRound = {
    ...round,
    playerHands: {
      ...round.playerHands,
      [handKey]: {
        ...hand,
        cardIds: [...hand.cardIds, draw.card.id],
      },
    },
  };

  nextRound = setHandStatusAfterHit(nextRound, handKey, draw.deck);

  const updatedHand = nextRound.playerHands[handKey];
  if (updatedHand.actionStatus === 'busted' || updatedHand.actionStatus === 'stood') {
    nextRound = advanceToNextHand(session, nextRound, handKey);
  }

  return {
    session,
    players: syncPlayerBetsFromRound(players, nextRound),
    deck: draw.deck,
    round: nextRound,
  };
}

export function standBlackjackPlayer(
  session: GameSession,
  players: Record<string, Player>,
  round: BlackjackRound,
  handKey: string,
): { session: GameSession; players: Record<string, Player>; round: BlackjackRound } {
  assertRoundStatus(round, ['player-turns'], 'stand');
  const hand = assertHandCanAct(round, handKey, 'stand');

  let nextRound: BlackjackRound = {
    ...round,
    playerHands: {
      ...round.playerHands,
      [handKey]: { ...hand, actionStatus: 'stood' },
    },
  };

  nextRound = advanceToNextHand(session, nextRound, handKey);
  return {
    session,
    players: syncPlayerBetsFromRound(players, nextRound),
    round: nextRound,
  };
}

export function doubleDownBlackjackPlayer(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: BlackjackRound,
  handKey: string,
  bankrollCtx: BankrollContext,
  settings?: BlackjackSettings,
  protocol?: BlackjackProtocol,
): {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
  deck: Deck;
  round: BlackjackRound;
} {
  assertRoundStatus(round, ['player-turns'], 'double down');
  const hand = assertHandCanAct(round, handKey, 'double down');
  const proto = protocol ?? getBlackjackProtocolOrDefault();
  const bankrollOwnerId = resolveBankrollOwnerId(bankrollCtx, hand.playerId);
  const rulesCtx = buildActiveRulesHandContext(
    proto,
    ledger,
    round,
    handKey,
    deck,
    bankrollOwnerId,
    derivePlayerBalanceFromLedger(bankrollOwnerId, ledger) - hand.currentBet,
  );
  if (!rulesCtx || !canDoubleUnderProtocol(proto, hand, rulesCtx)) {
    throw new Error('Double down not allowed for this protocol or hand');
  }

  const additionalBet = hand.currentBet;
  validateBetAmount(ledger, bankrollOwnerId, additionalBet, settings);

  const bet = appendBoxLedgerEntry(
    session,
    ledger,
    bankrollCtx,
    hand.playerId,
    'bet-increased',
    -additionalBet,
    `Double down: additional ${additionalBet} chips`,
  );

  let nextRound: BlackjackRound = {
    ...round,
    playerHands: {
      ...round.playerHands,
      [handKey]: {
        ...hand,
        currentBet: hand.currentBet + additionalBet,
        doubled: true,
      },
    },
  };

  const draw = drawCard(deck);
  if (!draw.card) {
    throw new Error('No cards remaining in deck');
  }

  nextRound = {
    ...nextRound,
    playerHands: {
      ...nextRound.playerHands,
      [handKey]: {
        ...nextRound.playerHands[handKey],
        cardIds: [...nextRound.playerHands[handKey].cardIds, draw.card.id],
      },
    },
  };

  nextRound = setHandStatusAfterHit(nextRound, handKey, draw.deck);
  const finalHand = nextRound.playerHands[handKey];
  if (finalHand.actionStatus === 'acting') {
    nextRound = {
      ...nextRound,
      playerHands: {
        ...nextRound.playerHands,
        [handKey]: { ...finalHand, actionStatus: 'stood' },
      },
    };
  }

  nextRound = advanceToNextHand(session, nextRound, handKey);

  return {
    session: bet.session,
    players: syncPlayerBetsFromRound(players, nextRound),
    ledger: bet.ledger,
    deck: draw.deck,
    round: nextRound,
  };
}

export function splitBlackjackPlayer(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: BlackjackRound,
  handKey: string,
  bankrollCtx: BankrollContext,
  settings: BlackjackSettings,
  protocol?: BlackjackProtocol,
): {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
  deck: Deck;
  round: BlackjackRound;
} {
  assertRoundStatus(round, ['player-turns'], 'split');
  const hand = assertHandCanAct(round, handKey, 'split');
  const proto = protocol ?? getBlackjackProtocolOrDefault();
  const bankrollOwnerId = resolveBankrollOwnerId(bankrollCtx, hand.playerId);
  const rulesCtx = buildActiveRulesHandContext(
    proto,
    ledger,
    round,
    handKey,
    deck,
    bankrollOwnerId,
    derivePlayerBalanceFromLedger(bankrollOwnerId, ledger) - hand.currentBet,
  );
  if (!rulesCtx || !canSplitUnderProtocol(proto, hand, { ...rulesCtx, deck })) {
    throw new Error('Split not allowed for this protocol or hand');
  }

  validateBetAmount(ledger, bankrollOwnerId, hand.currentBet, settings);

  const splitBet = appendBoxLedgerEntry(
    session,
    ledger,
    bankrollCtx,
    hand.playerId,
    'bet-increased',
    -hand.currentBet,
    `Split hand: additional ${hand.currentBet} chips`,
  );

  const playerHandKeys = listHandKeysForPlayer(round.playerHands, hand.playerId);
  const nextHandIndex =
    playerHandKeys.length === 0
      ? hand.handIndex + 1
      : Math.max(...playerHandKeys.map((key) => parseBlackjackHandKey(key).handIndex)) + 1;
  const newHandKey = blackjackHandKey(hand.playerId, nextHandIndex);

  const drawA = drawCard(deck);
  if (!drawA.card) {
    throw new Error('No cards remaining in deck');
  }
  const drawB = drawCard(drawA.deck);
  if (!drawB.card) {
    throw new Error('No cards remaining in deck');
  }

  const [firstCardId, secondCardId] = hand.cardIds;
  const splitCount = round.splitCounts[hand.playerId] ?? 0;

  const firstSplitHand = {
    ...hand,
    fromSplit: true,
    doubled: false,
    cardIds: [firstCardId, drawA.card.id],
    actionStatus: 'acting' as const,
  };

  const secondSplitHand = {
    ...hand,
    handIndex: nextHandIndex,
    fromSplit: true,
    doubled: false,
    cardIds: [secondCardId, drawB.card.id],
    actionStatus: 'acting' as const,
  };

  const nextRound = syncActivePlayerId({
    ...round,
    playerHands: {
      ...round.playerHands,
      [handKey]: firstSplitHand,
      [newHandKey]: secondSplitHand,
    },
    splitCounts: {
      ...round.splitCounts,
      [hand.playerId]: splitCount + 1,
    },
    activeHandKey: handKey,
    status: 'player-turns',
  });

  return {
    session: splitBet.session,
    players: syncPlayerBetsFromRound(players, nextRound),
    ledger: splitBet.ledger,
    deck: drawB.deck,
    round: nextRound,
  };
}

export function playDealerHand(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck,
  round: BlackjackRound,
  settings?: BlackjackSettings,
): { session: GameSession; players: Record<string, Player>; deck: Deck; round: BlackjackRound } {
  assertRoundStatus(round, ['bank-turn'], 'play dealer hand');

  if (shouldSkipBankDraw(session, round)) {
    return {
      session,
      players,
      deck,
      round: applySkipBankIfNeeded(session, round),
    };
  }

  dealerNeedsCards(deck);

  let nextRound: BlackjackRound = {
    ...round,
    dealerHoleHidden: false,
  };

  let nextDeck = deck;
  let dealerCards = cardsFromIds(nextDeck, nextRound.dealerCardIds);

  while (true) {
    if (!shouldDealerDraw(dealerCards, settings)) {
      break;
    }

    const draw = drawCard(nextDeck);
    if (!draw.card) {
      break;
    }
    nextDeck = draw.deck;
    nextRound = {
      ...nextRound,
      dealerCardIds: [...nextRound.dealerCardIds, draw.card.id],
    };
    dealerCards = cardsFromIds(nextDeck, nextRound.dealerCardIds);
  }

  return {
    session,
    players,
    deck: nextDeck,
    round: nextRound,
  };
}

function resolvePlayerOutcome(
  playerCards: Card[],
  dealerCards: Card[],
  bet: number,
  settings: BlackjackSettings,
  isNaturalBlackjack: boolean,
): { outcome: BlackjackOutcome; payout: number; message: string } {
  const playerVal = getBlackjackHandValue(playerCards);
  const dealerVal = getBlackjackHandValue(dealerCards);
  const playerStatus = getBlackjackHandStatus(playerCards);

  if (playerStatus === 'busted') {
    return {
      outcome: 'loss',
      payout: 0,
      message: `Bust (${playerVal.value}) - bet lost`,
    };
  }

  if (isNaturalBlackjack && dealerVal.isBlackjack) {
    return {
      outcome: 'blackjack-push',
      payout: bet,
      message: 'Push - both blackjack',
    };
  }

  if (isNaturalBlackjack) {
    const winnings = Math.floor(bet * settings.blackjackPayout);
    return {
      outcome: 'blackjack-win',
      payout: bet + winnings,
      message: `Blackjack! Win ${winnings} + bet returned (${bet + winnings} chips)`,
    };
  }

  if (dealerVal.isBlackjack) {
    return {
      outcome: 'loss',
      payout: 0,
      message: 'Dealer blackjack - bet lost',
    };
  }

  if (dealerVal.value > 21) {
    return {
      outcome: 'win',
      payout: bet * 2,
      message: `Dealer bust (${dealerVal.value}) - win ${bet} + bet returned`,
    };
  }

  if (playerVal.value > dealerVal.value) {
    return {
      outcome: 'win',
      payout: bet * 2,
      message: `Win ${playerVal.value} vs ${dealerVal.value} - ${bet * 2} chips`,
    };
  }

  if (playerVal.value < dealerVal.value) {
    return {
      outcome: 'loss',
      payout: 0,
      message: `Loss ${playerVal.value} vs ${dealerVal.value}`,
    };
  }

  return {
    outcome: 'push',
    payout: bet,
    message: `Push ${playerVal.value} vs ${dealerVal.value} - bet returned`,
  };
}

export function resolveBlackjackRound(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: BlackjackRound,
  settings: BlackjackSettings,
  bankrollCtx: BankrollContext,
): {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
  round: BlackjackRound;
} {
  assertRoundStatus(round, ['banking', 'bank-turn'], 'resolve round');

  if (round.isSettled) {
    return { session, players, ledger, round };
  }

  let nextSession = session;
  let nextLedger = ledger;
  const insSettled = settleInsuranceBets(nextSession, players, nextLedger, deck, round, bankrollCtx);
  nextSession = insSettled.session;
  nextLedger = insSettled.ledger;

  const dealerCards = cardsFromIds(deck, round.dealerCardIds);
  const outcomes: Record<string, BlackjackOutcome> = {};
  const resultMessages: Record<string, string> = {};
  let nextRound = round;
  const bankId = session.bankPlayerId;

  for (const handKey of orderedHandKeys(session, nextRound)) {
    const hand = nextRound.playerHands[handKey];
    if (!hand || hand.currentBet === 0) {
      continue;
    }

    if (hand.bustSettled) {
      outcomes[handKey] = 'loss';
      resultMessages[handKey] = nextRound.resultMessages[handKey] ?? 'BUST, my friend.';
      continue;
    }

    if (hand.naturalSettled) {
      outcomes[handKey] = nextRound.outcomes[handKey] ?? 'blackjack-win';
      resultMessages[handKey] = nextRound.resultMessages[handKey] ?? 'Blackjack paid';
      continue;
    }

    const playerCards = cardsFromIds(deck, hand.cardIds);
    const isNaturalBlackjack =
      !hand.fromSplit && playerCards.length === 2 && getBlackjackHandValue(playerCards).isBlackjack;
    const { outcome, payout, message } = resolvePlayerOutcome(
      playerCards,
      dealerCards,
      hand.currentBet,
      settings,
      isNaturalBlackjack,
    );

    outcomes[handKey] = outcome;
    resultMessages[handKey] = message;

    if (payout > 0) {
      const entryType =
        outcome === 'push' || outcome === 'blackjack-push'
          ? 'push-refund'
          : 'win-paid';

      const result = appendBoxLedgerEntry(
        nextSession,
        nextLedger,
        bankrollCtx,
        hand.playerId,
        entryType,
        payout,
        message,
        session.currentRound,
      );
      nextSession = result.session;
      nextLedger = result.ledger;
    } else if (outcome === 'loss') {
      const result = appendBoxLedgerEntry(
        nextSession,
        nextLedger,
        bankrollCtx,
        hand.playerId,
        'loss-collected',
        0,
        message,
        session.currentRound,
      );
      nextSession = result.session;
      nextLedger = result.ledger;
    }

    if (bankId) {
      const bet = hand.currentBet;
      if (outcome === 'loss') {
        const bankResult = appendBankLedgerEntry(
          nextSession,
          nextLedger,
          bankId,
          bet,
          `House collected ${bet} chips (${message})`,
          session.currentRound,
        );
        nextSession = bankResult.session;
        nextLedger = bankResult.ledger;
      } else if (payout > bet) {
        const bankPays = payout - bet;
        const bankResult = appendBankLedgerEntry(
          nextSession,
          nextLedger,
          bankId,
          -bankPays,
          `House paid ${bankPays} chips (${message})`,
          session.currentRound,
        );
        nextSession = bankResult.session;
        nextLedger = bankResult.ledger;
      }
    }

    nextRound = {
      ...nextRound,
      playerHands: {
        ...nextRound.playerHands,
        [handKey]: { ...hand, actionStatus: 'done' },
      },
    };
  }

  nextRound = syncActivePlayerId({
    ...nextRound,
    status: 'resolved',
    activeHandKey: null,
    dealerHoleHidden: false,
    outcomes,
    resultMessages,
    isSettled: true,
    settledAt: new Date().toISOString(),
  });

  return {
    session: { ...nextSession, status: 'round-complete' },
    players: syncPlayerBetsFromRound(players, nextRound),
    ledger: nextLedger,
    round: nextRound,
  };
}

export function resetBlackjackRound(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck | null,
): {
  session: GameSession;
  players: Record<string, Player>;
  deck: Deck | null;
  round: BlackjackRound;
} {
  if (!deck) {
    throw new Error('Deck required to start a new round');
  }

  const round = createInitialBlackjackRound(session);
  return {
    session: {
      ...session,
      currentRound: session.currentRound + 1,
      status: 'active',
    },
    players: resetPlayerRoundFields(players),
    deck,
    round,
  };
}

export function runDealerAndResolveIfNeeded(
  state: GameState,
): GameState {
  if (!state.blackjack || !state.deck || state.session.gameType !== 'blackjack') {
    return state;
  }

  let round = state.blackjack;
  let session = state.session;
  let players = state.players;
  const ledger = state.ledger;
  let deck = state.deck;
  const settings = state.blackjackSettings;
  const bankrollCtx = bankrollContextFromState(state);

  if (round.status === 'bank-turn') {
    const dealerPlayed = playDealerHand(session, players, deck, round, settings);
    session = dealerPlayed.session;
    players = dealerPlayed.players;
    deck = dealerPlayed.deck;
    round = { ...dealerPlayed.round, status: 'banking' as const };

    const resolved = resolveBlackjackRound(session, players, ledger, deck, round, settings, bankrollCtx);
    return {
      ...state,
      session: resolved.session,
      players: resolved.players,
      ledger: resolved.ledger,
      deck,
      blackjack: resolved.round,
    };
  }

  if (round.status === 'banking') {
    const resolved = resolveBlackjackRound(session, players, ledger, deck, round, settings, bankrollCtx);
    return {
      ...state,
      session: resolved.session,
      players: resolved.players,
      ledger: resolved.ledger,
      deck,
      blackjack: resolved.round,
    };
  }

  return state;
}

export function applyBlackjackToGameState(
  state: GameState,
  update: Partial<BlackjackEngineState> & { round: BlackjackRound },
): GameState {
  let next: GameState = {
    ...state,
    session: update.session ?? state.session,
    players: update.players ?? state.players,
    ledger: update.ledger ?? state.ledger,
    blackjack: update.round,
  };

  if (update.deck) {
    next = applyDeckToGameState(next, update.deck);
  }

  return next;
}

export { getBlackjackHandValue, getBlackjackHandStatus } from './hand';
