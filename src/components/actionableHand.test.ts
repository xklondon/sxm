import { describe, expect, it } from 'vitest';

import type { GameState } from '../types';
import type { BlackjackRound, BlackjackPlayerActionStatus } from '../types/blackjack';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack/handKeys';
import { processPlayFlowAutoStands } from '../engine/blackjack/gameState';
import { setPersonPlayFlow } from '../engine/blackjack/playFlow';
import { getCallerPersonIdForBox } from '../engine/session';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session/boxOps';
import {
  getActionableHandForView,
  getBlackjackRoundPhase,
  allowsBettingActions,
} from './blackjackViewPhase';

interface BoxHandSpec {
  boxId: string;
  cardIds: string[];
  status?: BlackjackPlayerActionStatus;
}

function playerTurnsRound(
  base: GameState,
  activeBoxId: string,
  hands: BoxHandSpec[],
): BlackjackRound {
  const playerHands: BlackjackRound['playerHands'] = {};
  for (const spec of hands) {
    const key = blackjackHandKey(spec.boxId, 0);
    playerHands[key] = {
      ...createBlackjackPlayerHand(spec.boxId, 0),
      cardIds: spec.cardIds,
      currentBet: 10,
      actionStatus: spec.status ?? 'acting',
    };
  }
  return {
    ...base.blackjack!,
    status: 'player-turns',
    activeHandKey: blackjackHandKey(activeBoxId, 0),
    activePlayerId: activeBoxId,
    playerHands,
  };
}

/** Boxes 1, 3, 4 owned by the same caller, Auto-stand on 18+. */
function multiBoxTable(): {
  state: GameState;
  box1: string;
  box3: string;
  box4: string;
  callerId: string;
} {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 3);
  state = claimBoxSlot(state, 4);
  const box1 = boxPlayerId(state, 1)!;
  const box3 = boxPlayerId(state, 3)!;
  const box4 = boxPlayerId(state, 4)!;
  const callerId = getCallerPersonIdForBox(state, box1)!;
  state = setPersonPlayFlow(state, callerId, 'auto-18');
  return { state, box1, box3, box4, callerId };
}

describe('online active-turn sync — auto-stand + actionable selector', () => {
  it('Box 1 (19) and Box 3 (20) auto-stand; Box 4 (13) becomes active', () => {
    const { state, box1, box3, box4, callerId } = multiBoxTable();
    const deck = state.deck!;
    const round = playerTurnsRound(state, box1, [
      { boxId: box1, cardIds: [findCardId(deck, 'K'), findCardId(deck, '9')] }, // 19
      { boxId: box3, cardIds: [findCardId(deck, 'Q'), findCardId(deck, '10')] }, // 20
      { boxId: box4, cardIds: [findCardId(deck, '6'), findCardId(deck, '7')] }, // 13
    ]);
    const next = processPlayFlowAutoStands({ ...state, blackjack: round });

    expect(next.blackjack!.activeHandKey).toBe(blackjackHandKey(box4, 0));
    expect(next.blackjack!.playerHands[blackjackHandKey(box1, 0)]!.actionStatus).toBe('stood');
    expect(next.blackjack!.playerHands[blackjackHandKey(box3, 0)]!.actionStatus).toBe('stood');

    // Only Box 4 is actionable for the caller.
    const actionable = getActionableHandForView(next, callerId, true);
    expect(actionable).not.toBeNull();
    expect(actionable!.boxId).toBe(box4);
    expect(actionable!.handKey).toBe(blackjackHandKey(box4, 0));
  });

  it('an 18+ hand that has already auto-stood is never actionable (HIT disabled)', () => {
    const { state, box1, callerId } = multiBoxTable();
    const deck = state.deck!;
    // Active key points at a stood 19 — selector must refuse it.
    const round = playerTurnsRound(state, box1, [
      {
        boxId: box1,
        cardIds: [findCardId(deck, 'K'), findCardId(deck, '9')],
        status: 'stood',
      },
    ]);
    const actionable = getActionableHandForView({ ...state, blackjack: round }, callerId, true);
    expect(actionable).toBeNull();
  });

  it('returns null when the viewer is not the box caller', () => {
    const { state, box4 } = multiBoxTable();
    const deck = state.deck!;
    const round = playerTurnsRound(state, box4, [
      { boxId: box4, cardIds: [findCardId(deck, '6'), findCardId(deck, '7')] },
    ]);
    const actionable = getActionableHandForView(
      { ...state, blackjack: round },
      'someone-else',
      true,
    );
    expect(actionable).toBeNull();
  });

  it('actionable hand is identical regardless of view mode / online flag (single source)', () => {
    const { state, box1, box3, box4, callerId } = multiBoxTable();
    const deck = state.deck!;
    const round = playerTurnsRound(state, box4, [
      { boxId: box1, cardIds: [findCardId(deck, 'K'), findCardId(deck, '9')], status: 'stood' },
      { boxId: box3, cardIds: [findCardId(deck, 'Q'), findCardId(deck, '10')], status: 'stood' },
      { boxId: box4, cardIds: [findCardId(deck, '6'), findCardId(deck, '7')] },
    ]);
    const s = { ...state, blackjack: round };

    // Full Table, Card View (desktop + mobile) all call this one selector; the
    // online flag never changes the result (activeHandKey is authoritative).
    const online = getActionableHandForView(s, callerId, true);
    const offline = getActionableHandForView(s, callerId, false);
    expect(online).toEqual(offline);
    expect(online?.boxId).toBe(box4);
  });
});

describe('shared betting/phase selectors — parity across views', () => {
  it('getBlackjackRoundPhase mirrors engine phase', () => {
    const { state } = multiBoxTable();
    expect(getBlackjackRoundPhase(state)).toBe('betting');
  });

  it('allowsBettingActions: open in betting, closed once locked', () => {
    const { state } = multiBoxTable();
    expect(allowsBettingActions(state)).toBe(true);

    const locked: typeof state = {
      ...state,
      tableMeta: { ...state.tableMeta, bettingLocked: true },
    };
    expect(allowsBettingActions(locked)).toBe(false);
  });

  it('allowsBettingActions is false during player turns', () => {
    const { state, box4 } = multiBoxTable();
    const deck = state.deck!;
    const round = playerTurnsRound(state, box4, [
      { boxId: box4, cardIds: [findCardId(deck, '6'), findCardId(deck, '7')] },
    ]);
    expect(allowsBettingActions({ ...state, blackjack: round })).toBe(false);
  });
});
