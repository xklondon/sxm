// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { blackjackHandKey } from '../engine/blackjack';
import { findCardId, tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';
import { actingRound } from '../engine/blackjack/sanity/fixtures';
import { hitBlackjackOnState } from '../engine/blackjack/gameState';
import type { GameState } from '../types';

import { CARD_VIEW_BUST_HOLD_MS } from './blackjackUxConstants';
import { useCardViewBustHold } from './useCardViewBustHold';

function practiceTable(): GameState {
  let state = tableWithClaimedBox(1);
  const box1 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      personPlayFlow: { [state.tableMeta.ownerPersonId!]: 'auto-18' },
    },
    blackjack: actingRound(state, box1, [findCardId(state.deck!, '10'), findCardId(state.deck!, '6')], 10),
  };
  return state;
}

describe('useCardViewBustHold', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses 3 second hold duration', () => {
    expect(CARD_VIEW_BUST_HOLD_MS).toBe(3000);
  });

  it('holds busted hand key after hit bust before timer elapses', () => {
    let state = practiceTable();
    const box1 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    const handKey = blackjackHandKey(box1, 0);
    state.blackjack!.activeHandKey = handKey;

    const { result, rerender } = renderHook(
      ({ gs }) => useCardViewBustHold(gs, 'player', true),
      { initialProps: { gs: state } },
    );

    state = hitBlackjackOnState(state, handKey);
    rerender({ gs: state });

    expect(result.current.holdHandKey).toBe(handKey);
    expect(result.current.holdBoxId).toBe(box1);

    act(() => {
      vi.advanceTimersByTime(CARD_VIEW_BUST_HOLD_MS);
    });

    expect(result.current.holdHandKey).toBeNull();
  });

  it('returns null when Card View hold is disabled', () => {
    const state = practiceTable();
    const { result } = renderHook(() => useCardViewBustHold(state, 'player', false));
    expect(result.current.holdHandKey).toBeNull();
  });
});
