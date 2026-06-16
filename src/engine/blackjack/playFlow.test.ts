import { describe, expect, it } from 'vitest';

import type { Card } from '../../types/deck';
import { blackjackHandKey } from './handKeys';
import { cardsFromIds } from './hand';
import { getCallerPersonIdForBox } from '../session/playerAssignment';
import { canSplitBlackjackForState, canDoubleBlackjackForState } from './validation';
import { processPlayFlowAutoStands } from './gameState';
import {
  getPlayFlowForPerson,
  setPersonPlayFlow,
  shouldAutoStandHand,
  shouldAutoStopPlayerHand,
  shouldAutoStopPlayerHandForState,
} from './playFlow';
import { actingRound, boxPlayerId, findCardId, tableWithClaimedBox } from './sanity/fixtures';

function card(rank: Card['rank'], suit: Card['suit'] = 'spades'): Card {
  return { id: `${rank}${suit}`, rank, suit };
}

describe('shouldAutoStandHand — soft ace uses minimum total', () => {
  it('does not auto-stand soft A+8 (19 soft / 9 hard) at auto-18', () => {
    expect(shouldAutoStandHand('auto-18', [card('A'), card('8')])).toBe(false);
  });

  it('does not auto-stand soft 3+4+A (18 soft / 8 hard) at auto-18', () => {
    expect(shouldAutoStandHand('auto-18', [card('3'), card('4'), card('A')])).toBe(false);
  });

  it('meets threshold on hard 10+8 at auto-18', () => {
    expect(shouldAutoStandHand('auto-18', [card('10'), card('8')])).toBe(true);
  });

  it('meets threshold on hard 9+9 at auto-18', () => {
    expect(shouldAutoStandHand('auto-18', [card('9'), card('9')])).toBe(true);
  });

  it('does not auto-stand when play flow is manual', () => {
    expect(shouldAutoStandHand('manual', [card('10'), card('8')])).toBe(false);
  });
});

describe('shouldAutoStopPlayerHand — optional actions block auto-stop', () => {
  it('does not auto-stop 9+9 when Split is legal', () => {
    expect(
      shouldAutoStopPlayerHand('auto-18', [card('9'), card('9')], {
        canSplit: true,
        canDouble: false,
      }),
    ).toBe(false);
  });

  it('does not auto-stop 10+10 when Split is legal', () => {
    expect(
      shouldAutoStopPlayerHand('auto-18', [card('10'), card('10')], {
        canSplit: true,
        canDouble: false,
      }),
    ).toBe(false);
  });

  it('does not auto-stop when Double is legal even if threshold is met', () => {
    expect(
      shouldAutoStopPlayerHand('auto-18', [card('10'), card('8')], {
        canSplit: false,
        canDouble: true,
      }),
    ).toBe(false);
  });

  it('does not auto-stop 9+2 when Double is legal (below auto-18 threshold)', () => {
    expect(
      shouldAutoStopPlayerHand('auto-18', [card('9'), card('2')], {
        canSplit: false,
        canDouble: true,
      }),
    ).toBe(false);
  });

  it('auto-stops hard 10+8 when no Split or Double is legal', () => {
    expect(
      shouldAutoStopPlayerHand('auto-18', [card('10'), card('8')], {
        canSplit: false,
        canDouble: false,
      }),
    ).toBe(true);
  });

  it('does not auto-stop soft A+8 at auto-18', () => {
    expect(
      shouldAutoStopPlayerHand('auto-18', [card('A'), card('8')], {
        canSplit: false,
        canDouble: false,
      }),
    ).toBe(false);
  });

  it('does not auto-stop soft 3+4+A at auto-18', () => {
    expect(
      shouldAutoStopPlayerHand('auto-18', [card('3'), card('4'), card('A')], {
        canSplit: false,
        canDouble: false,
      }),
    ).toBe(false);
  });
});

function autoStopTable(pairRank: '9' | '10') {
  let state = tableWithClaimedBox(1);
  const box1 = boxPlayerId(state, 1)!;
  const callerId = getCallerPersonIdForBox(state, box1)!;
  state = setPersonPlayFlow(state, callerId, 'auto-18');
  const handKey = blackjackHandKey(box1, 0);
  const cardIds = [findCardId(state.deck!, pairRank), findCardId(state.deck!, pairRank, 'hearts')];
  state = {
    ...state,
    blackjack: actingRound(state, box1, cardIds),
  };
  return { state, box1, handKey, callerId };
}

describe('processPlayFlowAutoStands — optional actions before auto-stop', () => {
  it('does not auto-stand 9+9 when Split is legal', () => {
    const { state, handKey } = autoStopTable('9');
    expect(canSplitBlackjackForState(state, handKey)).toBe(true);
    const next = processPlayFlowAutoStands(state);
    expect(next.blackjack!.playerHands[handKey]!.actionStatus).toBe('acting');
  });

  it('does not auto-stand 10+10 when Split is legal', () => {
    const { state, handKey } = autoStopTable('10');
    expect(canSplitBlackjackForState(state, handKey)).toBe(true);
    const next = processPlayFlowAutoStands(state);
    expect(next.blackjack!.playerHands[handKey]!.actionStatus).toBe('acting');
  });

  it('does not auto-stand 9+2 when Double is legal', () => {
    let state = tableWithClaimedBox(1);
    const box1 = boxPlayerId(state, 1)!;
    const callerId = getCallerPersonIdForBox(state, box1)!;
    state = setPersonPlayFlow(state, callerId, 'auto-18');
    const handKey = blackjackHandKey(box1, 0);
    state = {
      ...state,
      blackjack: actingRound(state, box1, [
        findCardId(state.deck!, '9'),
        findCardId(state.deck!, '2', 'hearts'),
      ]),
    };
    expect(canDoubleBlackjackForState(state, handKey)).toBe(true);
    const next = processPlayFlowAutoStands(state);
    expect(next.blackjack!.playerHands[handKey]!.actionStatus).toBe('acting');
  });

  it('auto-stands hard 10+8 when Double is disabled and Split is not legal', () => {
    let state = tableWithClaimedBox(1);
    const box1 = boxPlayerId(state, 1)!;
    const callerId = getCallerPersonIdForBox(state, box1)!;
    state = setPersonPlayFlow(state, callerId, 'auto-18');
    const handKey = blackjackHandKey(box1, 0);
    state = {
      ...state,
      blackjackSettings: { ...state.blackjackSettings, allowDoubleDown: false },
      blackjack: actingRound(state, box1, [
        findCardId(state.deck!, '10'),
        findCardId(state.deck!, '8', 'hearts'),
      ]),
    };
    const hand = state.blackjack!.playerHands[handKey]!;
    const cards = cardsFromIds(state.deck!, hand.cardIds.filter(Boolean));
    expect(
      shouldAutoStopPlayerHandForState(
        state,
        handKey,
        getPlayFlowForPerson(state, callerId),
        cards,
      ),
    ).toBe(true);
    const next = processPlayFlowAutoStands(state);
    expect(next.blackjack!.playerHands[handKey]!.actionStatus).toBe('stood');
  });
});
