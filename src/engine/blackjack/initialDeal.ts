import type { GameSession } from '../../types/session';
import type { Player } from '../../types/player';
import type { Deck } from '../../types/deck';
import type { BlackjackRound } from '../../types/blackjack';
import { drawCard } from '../deck/deck';
import { getBlackjackHandValue, cardsFromIds } from './hand';
import {
  assertRoundStatus,
  handKeysWithConfirmedBets,
  syncActivePlayerId,
  syncPlayerBetsFromRound,
} from './helpers';
import type { BlackjackSettings } from './settings';
import type { BlackjackProtocol } from './protocols/types';
import { activateInsuranceOfferIfNeeded, shouldOfferInsurance } from './insurance';
import { findNextActingHand } from './virtual';

export type InitialDealStep =
  | { type: 'box'; handKey: string; cardIndex: 0 | 1 }
  | { type: 'dealer'; cardIndex: 0 | 1 };

export function buildInitialDealPlan(
  session: GameSession,
  round: BlackjackRound,
  holeCardDealtLast = false,
): InitialDealStep[] {
  const handKeys =
    round.initialDealHandKeys?.length
      ? round.initialDealHandKeys
      : handKeysWithConfirmedBets(session, round);
  return buildInitialDealPlanFromHandKeys(handKeys, holeCardDealtLast);
}

export function buildInitialDealPlanFromHandKeys(
  handKeys: string[],
  holeCardDealtLast = false,
): InitialDealStep[] {
  const steps: InitialDealStep[] = [];
  for (const handKey of handKeys) {
    steps.push({ type: 'box', handKey, cardIndex: 0 });
  }
  steps.push({ type: 'dealer', cardIndex: 0 });
  for (const handKey of handKeys) {
    steps.push({ type: 'box', handKey, cardIndex: 1 });
  }
  if (!holeCardDealtLast) {
    steps.push({ type: 'dealer', cardIndex: 1 });
  }
  return steps;
}

function cardsForHand(_deck: Deck, handKey: string, round: BlackjackRound): string[] {
  return [...(round.playerHands[handKey]?.cardIds ?? [])];
}

export function beginInitialDeal(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck,
  round: BlackjackRound,
  handKeysOverride?: string[],
  settings?: BlackjackSettings,
): {
  session: GameSession;
  players: Record<string, Player>;
  deck: Deck;
  round: BlackjackRound;
} {
  assertRoundStatus(round, ['betting'], 'begin initial deal');
  const handKeys = handKeysOverride ?? handKeysWithConfirmedBets(session, round);
  const plan = buildInitialDealPlanFromHandKeys(handKeys, settings?.holeCardDealtLast ?? false);
  if (plan.length === 0) {
    throw new Error('Add chips to a betting box first');
  }
  if (deck.drawOrder.length < plan.length) {
    throw new Error(`Deck needs at least ${plan.length} cards to deal`);
  }

  return {
    session,
    players,
    deck,
    round: {
      ...round,
      status: 'initial-deal',
      initialDealStepIndex: 0,
      initialDealHandKeys: handKeys,
      dealerCardIds: [],
      dealerHoleHidden: true,
    },
  };
}

function finalizeAfterInitialDeal(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck,
  round: BlackjackRound,
  settings?: BlackjackSettings,
  protocol?: BlackjackProtocol,
): {
  session: GameSession;
  players: Record<string, Player>;
  deck: Deck;
  round: BlackjackRound;
} {
  const playerHandKeys = handKeysWithConfirmedBets(session, round);
  let nextRound: BlackjackRound = { ...round };
  delete nextRound.initialDealStepIndex;

  for (const handKey of playerHandKeys) {
    const hand = nextRound.playerHands[handKey];
    if (!hand) {
      continue;
    }
    const cards = cardsFromIds(deck, hand.cardIds);
    const { isBlackjack } = getBlackjackHandValue(cards);
    const actionStatus = isBlackjack ? 'blackjack' : 'acting';
    nextRound = {
      ...nextRound,
      playerHands: {
        ...nextRound.playerHands,
        [handKey]: { ...hand, actionStatus },
      },
    };
  }

  const firstActingHand = findNextActingHand(session, nextRound);
  const allInstant =
    firstActingHand === null &&
    playerHandKeys.every((handKey) => {
      const status = nextRound.playerHands[handKey]?.actionStatus;
      return status === 'blackjack' || status === 'busted';
    });

  const insuranceOffer =
    settings && shouldOfferInsurance(nextRound, deck, settings, protocol);

  if (insuranceOffer) {
    nextRound = activateInsuranceOfferIfNeeded(nextRound, deck, settings!, session, protocol);
  }

  const insurancePending = Boolean(nextRound.insuranceOfferPending);

  nextRound = syncActivePlayerId({
    ...nextRound,
    activeHandKey: insurancePending ? null : firstActingHand,
    status: allInstant && !insurancePending ? 'bank-turn' : 'player-turns',
    dealerHoleHidden: insurancePending ? true : !allInstant,
  });

  return {
    session,
    players: syncPlayerBetsFromRound(players, nextRound),
    deck,
    round: nextRound,
  };
}

export function dealNextInitialCard(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck,
  round: BlackjackRound,
  settings?: BlackjackSettings,
  protocol?: BlackjackProtocol,
): {
  session: GameSession;
  players: Record<string, Player>;
  deck: Deck;
  round: BlackjackRound;
  step: InitialDealStep;
  cardId: string;
  complete: boolean;
} {
  assertRoundStatus(round, ['initial-deal'], 'deal initial card');
  const plan = buildInitialDealPlan(session, round, settings?.holeCardDealtLast ?? false);
  const stepIndex = round.initialDealStepIndex ?? 0;
  if (stepIndex >= plan.length) {
    throw new Error('Initial deal already complete');
  }

  const step = plan[stepIndex]!;
  const draw = drawCard(deck);
  if (!draw.card) {
    throw new Error('No cards remaining in deck');
  }

  let nextRound = { ...round };

  if (step.type === 'box') {
    const hand = nextRound.playerHands[step.handKey];
    if (!hand) {
      throw new Error(`Hand ${step.handKey} not found`);
    }
    const cardIds = cardsForHand(deck, step.handKey, nextRound);
    while (cardIds.length <= step.cardIndex) {
      cardIds.push('');
    }
    cardIds[step.cardIndex] = draw.card.id;
    nextRound = {
      ...nextRound,
      playerHands: {
        ...nextRound.playerHands,
        [step.handKey]: { ...hand, cardIds },
      },
    };
  } else {
    const dealerCardIds = [...nextRound.dealerCardIds];
    while (dealerCardIds.length <= step.cardIndex) {
      dealerCardIds.push('');
    }
    dealerCardIds[step.cardIndex] = draw.card.id;
    nextRound = {
      ...nextRound,
      dealerCardIds,
      dealerHoleHidden: step.cardIndex === 1,
    };
  }

  const nextIndex = stepIndex + 1;
  if (nextIndex >= plan.length) {
    const finalized = finalizeAfterInitialDeal(session, players, draw.deck, {
      ...nextRound,
      initialDealStepIndex: undefined,
    }, settings, protocol);
    return {
      ...finalized,
      step,
      cardId: draw.card.id,
      complete: true,
    };
  }

  return {
    session,
    players,
    deck: draw.deck,
    round: { ...nextRound, initialDealStepIndex: nextIndex },
    step,
    cardId: draw.card.id,
    complete: false,
  };
}

/** Deal all initial cards at once (engine shortcut). */
export function dealInitialBlackjackCardsFast(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck,
  round: BlackjackRound,
  settings?: BlackjackSettings,
  protocol?: BlackjackProtocol,
): {
  session: GameSession;
  players: Record<string, Player>;
  deck: Deck;
  round: BlackjackRound;
} {
  let state = beginInitialDeal(session, players, deck, round, undefined, settings);
  let guard = 0;
  while (state.round.status === 'initial-deal' && guard < 50) {
    guard += 1;
    const next = dealNextInitialCard(state.session, state.players, state.deck, state.round, settings, protocol);
    state = {
      session: next.session,
      players: next.players,
      deck: next.deck,
      round: next.round,
    };
  }
  return state;
}
