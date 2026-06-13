import { describe, expect, it } from 'vitest';

import {
  applyCardVisibility,
  emptyCardVisibility,
  getDisplayedHandValue,
  maxVisibilityForRound,
  resolveRevealScopeTransition,
} from '../../../components/blackjackDealingContract';
import { canShowPlayerDecisionControls } from '../../../components/blackjackActionContract';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
  withInstantInitialDeal,
} from '../sanity/fixtures';
import { addChipToBoxStake } from '../index';
import { claimBoxSlot } from '../../session';

function seatedTable() {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const ownerId = state.tableMeta.ownerPersonId!;
  return { state, ownerId, box1: boxPlayerId(state, 1)! };
}

describe('dealing round regression — round 1', () => {
  it('natural deal hides values until active hand reveal completes', () => {
    const { state, box1 } = seatedTable();
    const handKey = `${box1}:0`;
    const s = {
      ...state,
      blackjackFlowSettings: { ...state.blackjackFlowSettings, initialDealMode: 'natural' as const },
      blackjack: {
        ...actingRound(
          state,
          box1,
          [findCardId(state.deck!, '8'), findCardId(state.deck!, '3')],
          50,
        ),
        dealerCardIds: [findCardId(state.deck!, '10'), findCardId(state.deck!, '6')],
      },
    };
    s.blackjack!.activeHandKey = handKey;

    const hidden = applyCardVisibility(s, emptyCardVisibility());
    expect(getDisplayedHandValue(hidden.deck, hidden.blackjack, handKey)).toBeNull();
    expect(
      canShowPlayerDecisionControls(s, 'dealing', {
        cardRevealComplete: false,
        activeHandRevealComplete: false,
      }),
    ).toBe(false);

    const visible = applyCardVisibility(s, maxVisibilityForRound(s.blackjack!));
    expect(getDisplayedHandValue(visible.deck, visible.blackjack, handKey)).toBe(11);
    expect(
      canShowPlayerDecisionControls(s, 'dealing', {
        cardRevealComplete: false,
        activeHandRevealComplete: true,
      }),
    ).toBe(true);
  });

  it('instant deal shows values immediately (round 1 mid-round snapshot)', () => {
    const { state, box1 } = seatedTable();
    const handKey = `${box1}:0`;
    const s = withInstantInitialDeal({
      ...state,
      blackjack: actingRound(
        state,
        box1,
        [findCardId(state.deck!, '5'), findCardId(state.deck!, '6')],
        25,
      ),
    });
    s.blackjack!.activeHandKey = handKey;

    const full = applyCardVisibility(s, maxVisibilityForRound(s.blackjack!));
    expect(getDisplayedHandValue(full.deck, full.blackjack, handKey)).toBe(11);
  });
});

describe('dealing round regression — round 2', () => {
  it('round scope change resets reveal queue (round 2 guard)', () => {
    expect(resolveRevealScopeTransition(null, 'table-a:1')).toBe('hydrate');
    expect(resolveRevealScopeTransition('table-a:1', 'table-a:2')).toBe('reset');
    expect(resolveRevealScopeTransition('table-a:2', 'table-a:2')).toBe('continue');
  });

  it('stale visibility hides hand values after round hand set changes', () => {
    const { state, box1 } = seatedTable();
    const handKey = `${box1}:0`;
    const round = actingRound(
      state,
      box1,
      [findCardId(state.deck!, '9'), findCardId(state.deck!, '2')],
      50,
    );
    const staleVisibility = maxVisibilityForRound({
      ...round,
      playerHands: {},
      dealerCardIds: [],
    });
    const s = { ...state, blackjack: round };
    expect(getDisplayedHandValue(s.deck, s.blackjack, handKey)).not.toBeNull();
    const hidden = applyCardVisibility(s, staleVisibility);
    expect(getDisplayedHandValue(hidden.deck, hidden.blackjack, handKey)).toBeNull();
  });

  it('round 2 player turn still gates controls on reveal readiness', () => {
    const { state, box1 } = seatedTable();
    const deck = state.deck!;
    const s = {
      ...state,
      session: { ...state.session, currentRound: 2 },
      blackjack: {
        ...actingRound(
          state,
          box1,
          [findCardId(deck, '9'), findCardId(deck, '2')],
          50,
        ),
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      },
    };
    s.blackjack!.activeHandKey = `${box1}:0`;

    expect(
      canShowPlayerDecisionControls(s, 'player', {
        cardRevealComplete: false,
        activeHandRevealComplete: false,
      }),
    ).toBe(false);
    expect(
      canShowPlayerDecisionControls(s, 'player', {
        cardRevealComplete: true,
        activeHandRevealComplete: true,
      }),
    ).toBe(true);
  });
});

describe('dealing round regression — multi-box same player', () => {
  it('round 1 betting phase keeps decision controls off while cards unrevealed', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 2);
    const box1 = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, box1, 50, state.tableMeta.ownerPersonId!);

    const hidden = applyCardVisibility(state, emptyCardVisibility());
    expect(getDisplayedHandValue(hidden.deck, hidden.blackjack, `${box1}:0`)).toBeNull();
    expect(
      canShowPlayerDecisionControls(hidden, 'betting', {
        cardRevealComplete: true,
        activeHandRevealComplete: true,
      }),
    ).toBe(false);
  });
});
