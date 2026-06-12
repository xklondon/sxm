import { describe, expect, it } from 'vitest';
import {
  applyCardVisibility,
  applyRevealStep,
  buildInitialRevealSteps,
  emptyCardVisibility,
  getDisplayedHandValue,
  hasPendingCardReveal,
  isActionRevealReady,
  isStaleHandVisibility,
  maxVisibilityForRound,
  resolveRevealScopeTransition,
  shouldUseOrderedInitialReveal,
} from './cardRevealDisplay';
import { isPacedCardReveal } from './dealingModes';
import { canShowPlayerDecisionControls } from '../../../components/blackjackViewPhase';
import { blackjackHandKey } from '../handKeys';
import {
  completeStepwiseInitialDealIfNeeded,
  dealCardsButtonOnState,
  dealNextInitialCardOnState,
  shuffleToStartOnState,
  startNextRoundOnState,
} from '../gameState';
import { addChipToBoxStake } from '../stakes';
import { tableWithClaimedBox, boxPlayerId } from '../sanity/fixtures';
import { createBlackjackShoe, shuffleBlackjackShoe } from '../shoe';

function simulateNaturalRevealLabels(
  round: NonNullable<ReturnType<typeof dealCardsButtonOnState>['blackjack']>,
): string[] {
  const target = maxVisibilityForRound(round);
  let visible = emptyCardVisibility();
  const steps = buildInitialRevealSteps(round);
  const labels: string[] = [];
  let guard = 0;
  while (
    guard < 30 &&
    shouldUseOrderedInitialReveal(round.status, visible, target)
  ) {
    guard += 1;
    let nextVisible = null;
    for (const step of steps) {
      const after = applyRevealStep(visible, step);
      const changed =
        after.dealer !== visible.dealer ||
        Object.keys(after.hands).some(
          (k) => (after.hands[k] ?? 0) !== (visible.hands[k] ?? 0),
        );
      if (changed) {
        nextVisible = after;
        labels.push(
          step.type === 'dealer' ? `D${step.cardIndex}` : `${step.handKey}:${step.cardIndex}`,
        );
        break;
      }
    }
    if (!nextVisible) {
      break;
    }
    visible = nextVisible;
  }
  return labels;
}

function tableReadyForDeal() {
  let state = tableWithClaimedBox(1);
  const boxId = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, boxId, 10);
  state = shuffleToStartOnState(state);
  state = {
    ...state,
    deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'round-reset'),
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'natural',
    },
  };
  return state;
}

describe('card reveal round reset', () => {
  it('resets reveal scope on same-table round change', () => {
    expect(resolveRevealScopeTransition('table-a:1', 'table-a:2')).toBe('reset');
    expect(resolveRevealScopeTransition('table-a:1', 'table-a:1')).toBe('continue');
    expect(resolveRevealScopeTransition(null, 'table-a:1')).toBe('hydrate');
    expect(resolveRevealScopeTransition('table-a:1', 'table-b:1')).toBe('hydrate');
  });

  it('detects stale hand keys from a prior round', () => {
    const staleVisible = { dealer: 2, hands: { 'old-player:0': 2 } };
    const roundTarget = { dealer: 2, hands: { 'new-player:0': 2 } };
    expect(isStaleHandVisibility(staleVisible, roundTarget)).toBe(true);
    expect(hasPendingCardReveal(staleVisible, roundTarget)).toBe(true);
    expect(shouldUseOrderedInitialReveal('player-turns', staleVisible, roundTarget)).toBe(true);
  });

  it('round 1 and round 2 natural dealing share the same ordered reveal labels', () => {
    let state = tableReadyForDeal();
    state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const round1 = state.blackjack!;
    const round1Labels = simulateNaturalRevealLabels(round1);

    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        awaitingNextRound: true,
        bettingLocked: true,
      },
    };
    state = startNextRoundOnState(state);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 10);
    state = shuffleToStartOnState(state);
    state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const round2 = state.blackjack!;
    const round2Labels = simulateNaturalRevealLabels(round2);

    expect(round2Labels.length).toBeGreaterThan(0);
    expect(round2Labels).toEqual(round1Labels);
    expect(round2Labels.findIndex((l) => l.startsWith('D0'))).toBeGreaterThan(0);
  });

  it('manual staged dealing advances the same ordered queue one card at a time', () => {
    let state = tableReadyForDeal();
    state = {
      ...state,
      blackjackFlowSettings: {
        ...state.blackjackFlowSettings,
        initialDealMode: 'staged',
      },
    };
    state = dealCardsButtonOnState(state);
    const labels: string[] = [];
    let visible = emptyCardVisibility();

    while (state.blackjack?.status === 'initial-deal') {
      state = dealNextInitialCardOnState(state);
      const round = state.blackjack!;
      const target = maxVisibilityForRound(round);
      const steps = buildInitialRevealSteps(round);
      for (const step of steps) {
        const after = applyRevealStep(visible, step);
        const changed =
          after.dealer !== visible.dealer ||
          Object.keys(after.hands).some(
            (k) => (after.hands[k] ?? 0) !== (visible.hands[k] ?? 0),
          );
        if (changed && hasPendingCardReveal(visible, target)) {
          visible = after;
          labels.push(
            step.type === 'dealer' ? `D${step.cardIndex}` : `${step.handKey}:${step.cardIndex}`,
          );
          break;
        }
      }
    }

    const handKey = blackjackHandKey(boxPlayerId(state, 1)!, 0);
    expect(labels[0]).toBe(`${handKey}:0`);
    expect(labels.some((l) => l === 'D0')).toBe(true);
  });

  it('hides bank and box values until cards are visible', () => {
    let state = tableReadyForDeal();
    state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const masked = applyCardVisibility(state, emptyCardVisibility());

    expect(getDisplayedHandValue(masked.deck, masked.blackjack, handKey)).toBeNull();
    expect(masked.blackjack!.dealerCardIds.filter(Boolean)).toHaveLength(0);

    const afterUp = applyCardVisibility(state, { dealer: 1, hands: { [handKey]: 1 } });
    expect(getDisplayedHandValue(afterUp.deck, afterUp.blackjack, handKey)).not.toBeNull();
    expect(afterUp.blackjack!.dealerCardIds.filter(Boolean)).toHaveLength(1);
  });

  it('blocks player controls until paced reveal catches up', () => {
    let state = tableReadyForDeal();
    state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
      },
    };
    expect(isPacedCardReveal(state.blackjackFlowSettings.initialDealMode)).toBe(true);
    expect(
      canShowPlayerDecisionControls(state, 'player', {
        cardRevealComplete: false,
        activeHandRevealComplete: false,
      }),
    ).toBe(false);
    expect(
      isActionRevealReady(true, {
        cardRevealComplete: false,
        activeHandRevealComplete: true,
      }),
    ).toBe(true);
    expect(
      canShowPlayerDecisionControls(state, 'player', {
        cardRevealComplete: false,
        activeHandRevealComplete: true,
      }),
    ).toBe(true);
  });
});
