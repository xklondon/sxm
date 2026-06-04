import { describe, expect, it } from 'vitest';
import { cardDealDelayMs, normalizeFlowSettings } from '../flowSettings';
import { isNaturalInitialDeal } from './dealingModes';
import {
  applyCardVisibility,
  buildInitialRevealSteps,
  countVisibleCards,
  maxVisibilityForRound,
  totalCardCount,
} from './cardRevealDisplay';
import { tableWithClaimedBox, boxPlayerId } from '../sanity/fixtures';
import { addChipToBoxStake } from '../stakes';
import {
  dealCardsButtonOnState,
  completeStepwiseInitialDealIfNeeded,
  shuffleToStartOnState,
} from '../gameState';
import type { BlackjackRound } from '../../../types/blackjack';
import { createBlackjackPlayerHand, createEmptyBlackjackRound } from '../../../types/blackjack';
import { blackjackHandKey } from '../handKeys';

describe('cardRevealDisplay', () => {
  it('masks cards to visibility counts', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      blackjack: {
        ...createEmptyBlackjackRound(),
        status: 'player-turns',
        playerHands: {
          [handKey]: {
            ...createBlackjackPlayerHand(boxId, 0),
            cardIds: ['c1', 'c2'],
            currentBet: 10,
            actionStatus: 'acting',
          },
        },
        dealerCardIds: ['d1', 'd2'],
        dealerHoleHidden: true,
        activeHandKey: handKey,
        activePlayerId: boxId,
        insuranceOfferPending: false,
        evenMoneyOfferHandKey: null,
      } satisfies BlackjackRound,
    };
    const masked = applyCardVisibility(state, {
      dealer: 1,
      hands: { [handKey]: 1 },
    });
    expect(masked.blackjack!.dealerCardIds).toHaveLength(1);
    expect(masked.blackjack!.playerHands[handKey]!.cardIds).toHaveLength(1);
  });

  function tableReadyToDeal(): ReturnType<typeof tableWithClaimedBox> {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 10);
    state = shuffleToStartOnState(state);
    return state;
  }

  it('builds initial reveal steps in deal order', () => {
    let state = tableReadyToDeal();
    state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const steps = buildInitialRevealSteps(state.blackjack!);
    expect(steps.length).toBeGreaterThan(2);
    expect(steps[0]?.type).toBe('box');
    expect(steps.some((s) => s.type === 'dealer')).toBe(true);
    expect(steps[steps.length - 1]).toEqual({ type: 'dealer', cardIndex: 1 });
  });

  it('reveal plan includes dealer hole when hole card exists in state', () => {
    let state = tableReadyToDeal();
    state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const round = state.blackjack!;
    expect(round.dealerHoleHidden).toBe(true);
    expect(round.dealerCardIds[1]).toBeTruthy();
    const steps = buildInitialRevealSteps(round);
    expect(steps.filter((s) => s.type === 'dealer' && s.cardIndex === 1)).toHaveLength(1);
  });

  it('natural mode uses deal speed presets for pacing', () => {
    expect(isNaturalInitialDeal('natural')).toBe(true);
    expect(isNaturalInitialDeal('instant')).toBe(false);
    expect(cardDealDelayMs(normalizeFlowSettings({ dealSpeedPreset: 'fast' }))).toBe(1000);
    expect(cardDealDelayMs(normalizeFlowSettings({ dealSpeedPreset: 'normal' }))).toBe(3000);
    expect(cardDealDelayMs(normalizeFlowSettings({ dealSpeedPreset: 'slow' }))).toBe(5000);
  });

  it('full deal has more cards than empty visibility', () => {
    let state = tableReadyToDeal();
    state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const target = maxVisibilityForRound(state.blackjack);
    expect(totalCardCount(target)).toBeGreaterThan(2);
    expect(totalCardCount(countVisibleCards(null))).toBe(0);
  });
});
