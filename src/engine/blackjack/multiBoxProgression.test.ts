import { describe, expect, it } from 'vitest';

import type { GameState } from '../../types';
import type { BlackjackRound, BlackjackPlayerActionStatus } from '../../types/blackjack';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import { blackjackHandKey } from './handKeys';
import {
  standBlackjackOnState,
  doubleDownBlackjackOnState,
  hitBlackjackOnState,
  syncBankPhaseOnState,
} from './gameState';
import { applySkipBankIfNeeded } from './roundFlow';
import { resolvePendingNaturalsAfterDealerPeek } from './naturalBlackjack';
import {
  tableWithTwoBoxesSamePerson,
  boxPlayerId,
  findCardId,
} from './sanity/fixtures';

interface BoxHandSpec {
  boxId: string;
  cardIds: string[];
  status?: BlackjackPlayerActionStatus;
}

function twoBoxTurnState(
  base: GameState,
  activeBoxId: string,
  hands: BoxHandSpec[],
): GameState {
  const playerHands: BlackjackRound['playerHands'] = {};
  for (const spec of hands) {
    const key = blackjackHandKey(spec.boxId, 0);
    playerHands[key] = {
      ...createBlackjackPlayerHand(spec.boxId, 0),
      cardIds: spec.cardIds,
      currentBet: 50,
      actionStatus: spec.status ?? 'acting',
    };
  }
  return {
    ...base,
    blackjack: {
      ...base.blackjack!,
      status: 'player-turns',
      activeHandKey: blackjackHandKey(activeBoxId, 0),
      activePlayerId: activeBoxId,
      dealerCardIds: [
        findCardId(base.deck!, '7'),
        findCardId(base.deck!, 'K'),
      ],
      dealerHoleHidden: true,
      playerHands,
    },
  };
}

describe('multi-box turn progression — same caller, two boxes', () => {
  const base = tableWithTwoBoxesSamePerson();
  const deck = base.deck!;
  const box1 = boxPlayerId(base, 1)!;
  const box2 = boxPlayerId(base, 2)!;
  const k1 = blackjackHandKey(box1, 0);
  const k2 = blackjackHandKey(box2, 0);

  it('Box 1 stand → Box 2 becomes active', () => {
    const state = twoBoxTurnState(base, box1, [
      { boxId: box1, cardIds: [findCardId(deck, '10'), findCardId(deck, '9')] },
      { boxId: box2, cardIds: [findCardId(deck, '8'), findCardId(deck, '7')] },
    ]);
    const next = standBlackjackOnState(state, k1);
    expect(next.blackjack!.activeHandKey).toBe(k2);
    expect(next.blackjack!.status).toBe('player-turns');
    expect(next.blackjack!.playerHands[k1]!.actionStatus).toBe('stood');
    expect(next.blackjack!.playerHands[k2]!.actionStatus).toBe('acting');
  });

  it('Box 1 bust → Box 2 becomes active', () => {
    const state = twoBoxTurnState(base, box1, [
      { boxId: box1, cardIds: [findCardId(deck, '10'), findCardId(deck, '9')] },
      { boxId: box2, cardIds: [findCardId(deck, '8'), findCardId(deck, '7')] },
    ]);
    // Force a bust on box 1 with a high card draw order — hit until bust or use rigged cards
    const bustState = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        playerHands: {
          ...state.blackjack!.playerHands,
          [k1]: {
            ...state.blackjack!.playerHands[k1]!,
            cardIds: [findCardId(deck, '10'), findCardId(deck, '9'), findCardId(deck, 'K')],
          },
        },
      },
    };
    const next = hitBlackjackOnState(bustState, k1);
    expect(next.blackjack!.playerHands[k1]!.actionStatus).toBe('busted');
    expect(next.blackjack!.activeHandKey).toBe(k2);
    expect(next.blackjack!.status).toBe('player-turns');
  });

  it('Box 1 double → Box 2 becomes active', () => {
    const state = twoBoxTurnState(base, box1, [
      { boxId: box1, cardIds: [findCardId(deck, '5'), findCardId(deck, '6')] },
      { boxId: box2, cardIds: [findCardId(deck, '8'), findCardId(deck, '7')] },
    ]);
    const next = doubleDownBlackjackOnState(state, k1);
    expect(next.blackjack!.activeHandKey).toBe(k2);
    expect(next.blackjack!.status).toBe('player-turns');
    expect(next.blackjack!.playerHands[k1]!.doubled).toBe(true);
  });

  it('after last player box completes, bank/dealer phase begins', () => {
    const state = twoBoxTurnState(base, box2, [
      { boxId: box1, cardIds: [findCardId(deck, '10'), findCardId(deck, '9')], status: 'stood' },
      { boxId: box2, cardIds: [findCardId(deck, '8'), findCardId(deck, '7')] },
    ]);
    const next = syncBankPhaseOnState(standBlackjackOnState(state, k2));
    expect(['bank-turn', 'banking']).toContain(next.blackjack!.status);
    expect(next.blackjack!.activeHandKey).toBeNull();
  });

  it('stale active hand after natural peek advances to next acting box', () => {
    const state = twoBoxTurnState(base, box1, [
      {
        boxId: box1,
        cardIds: [findCardId(deck, 'A'), findCardId(deck, 'K')],
        status: 'blackjack',
      },
      { boxId: box2, cardIds: [findCardId(deck, '8'), findCardId(deck, '7')] },
    ]);
    const stale = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        activeHandKey: k1,
        dealerCardIds: [findCardId(deck, '7'), findCardId(deck, '9')],
        dealerHoleHidden: false,
      },
    };
    const next = resolvePendingNaturalsAfterDealerPeek(stale);
    expect(next.blackjack!.playerHands[k1]!.naturalSettled).toBe(true);
    expect(next.blackjack!.activeHandKey).toBe(k2);
    expect(next.blackjack!.status).toBe('player-turns');
  });

  it('repairStaleActiveHandKey via applySkipBankIfNeeded', () => {
    const stale = twoBoxTurnState(base, box1, [
      { boxId: box1, cardIds: [findCardId(deck, '10'), findCardId(deck, '9')], status: 'stood' },
      { boxId: box2, cardIds: [findCardId(deck, '8'), findCardId(deck, '7')] },
    ]);
    const repaired = applySkipBankIfNeeded(stale.session, stale.blackjack!);
    expect(repaired.activeHandKey).toBe(k2);
  });
});
