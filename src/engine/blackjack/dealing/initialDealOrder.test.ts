import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../types';
import { tableAfterStartPlaying, boxPlayerId } from '../sanity/fixtures';
import { claimBoxSlot } from '../../session/boxOps';
import { resolveControllerPersonId } from '../../session';
import { addChipToBoxStake } from '../stakes';
import { createBlackjackShoe, shuffleBlackjackShoe } from '../shoe';
import { blackjackHandKey } from '../handKeys';
import {
  buildInitialDealPlan,
  buildInitialDealPlanFromHandKeys,
  dealNextInitialCard,
} from '../initialDeal';
import { buildInitialDealSequence } from '../dealSequence';
import {
  buildInitialRevealSteps,
  shouldUseOrderedInitialReveal,
  shouldHydrateCardRevealScope,
  applyCardVisibility,
  maxVisibilityForRound,
} from './cardRevealDisplay';
import { getEligibleDealBoxes } from '../dealEligibility';
import { getActiveHandKeysForDeal } from '../protocol';
import { getBettingPlayerIds, handKeysWithConfirmedBets } from '../helpers';
import {
  shuffleToStartOnState,
  beginInitialDealOnState,
  dealNextInitialCardOnState,
  dealCardsButtonOnState,
  completeStepwiseInitialDealIfNeeded,
} from '../gameState';

function planLabels(handKeys: string[], holeCardDealtLast = false): string[] {
  return buildInitialDealPlanFromHandKeys(handKeys, holeCardDealtLast).map((step) =>
    step.type === 'dealer'
      ? `D${step.cardIndex}`
      : `${step.handKey}:${step.cardIndex}`,
  );
}

function readyOneBox(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const boxId = boxPlayerId(state, 1)!;
  const personId = resolveControllerPersonId(state, 'Alice') ?? undefined;
  state = addChipToBoxStake(state, boxId, 50, personId);
  const started = shuffleToStartOnState(state);
  return { ...started, deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'initial-deal-1box') };
}

function readyThreeBoxes(): GameState {
  let state = tableAfterStartPlaying(500);
  for (const slot of [1, 3, 4]) {
    state = claimBoxSlot(state, slot);
  }
  const personId = resolveControllerPersonId(state, 'Alice') ?? undefined;
  for (const slot of [1, 3, 4]) {
    const boxId = boxPlayerId(state, slot)!;
    state = addChipToBoxStake(state, boxId, 50, personId);
  }
  const started = shuffleToStartOnState(state);
  return { ...started, deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'initial-deal-3box') };
}

describe('initial deal order', () => {
  it('eligible deal boxes follow RTL play order', () => {
    const state = readyThreeBoxes();
    const eligible = getEligibleDealBoxes(state);
    const orderedEligible = getBettingPlayerIds(state.session).filter((id) => eligible.includes(id));
    expect(eligible).toEqual(orderedEligible);
    expect(getActiveHandKeysForDeal(state).map((k) => k.split(':')[0])).toEqual(orderedEligible);
  });

  it('one box: box1, dealer up, box2, dealer hole', () => {
    const state = readyOneBox();
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const labels = planLabels([handKey]);
    expect(labels).toEqual([`${handKey}:0`, 'D0', `${handKey}:1`, 'D1']);
  });

  it('three boxes: all first cards, dealer up, all second cards, dealer hole', () => {
    const state = readyThreeBoxes();
    const keys = getActiveHandKeysForDeal(state);
    expect(keys).toHaveLength(3);
    const labels = planLabels(keys);
    expect(labels.slice(0, 3).every((l) => l.endsWith(':0'))).toBe(true);
    expect(labels[3]).toBe('D0');
    expect(labels.slice(4, 7).every((l) => l.endsWith(':1'))).toBe(true);
    expect(labels[7]).toBe('D1');
    expect(labels).toHaveLength(8);
  });

  it('dealer up-card only after every box receives first card', () => {
    const state = readyThreeBoxes();
    const plan = buildInitialDealPlan(state.session, {
      ...state.blackjack!,
      initialDealHandKeys: getActiveHandKeysForDeal(state),
      playerHands: {},
      dealerCardIds: [],
    });
    const firstDealerIdx = plan.findIndex((s) => s.type === 'dealer' && s.cardIndex === 0);
    expect(firstDealerIdx).toBe(3);
    expect(plan.slice(0, firstDealerIdx).every((s) => s.type === 'box' && s.cardIndex === 0)).toBe(
      true,
    );
  });

  it('dealer hole only after every box receives second card', () => {
    const state = readyThreeBoxes();
    const handKeys = getActiveHandKeysForDeal(state);
    const plan = buildInitialDealPlanFromHandKeys(handKeys);
    const holeIdx = plan.findIndex((s) => s.type === 'dealer' && s.cardIndex === 1);
    expect(holeIdx).toBe(plan.length - 1);
    const beforeHole = plan.slice(0, holeIdx);
    expect(beforeHole.filter((s) => s.type === 'box' && s.cardIndex === 1)).toHaveLength(3);
  });

  it('activeHandKey stays unset until initial deal and naturals resolve', () => {
    let state = beginInitialDealOnState(readyOneBox());
    expect(state.blackjack!.activeHandKey).toBeNull();
    expect(state.blackjack!.status).toBe('initial-deal');

    let guard = 0;
    while (state.blackjack?.status === 'initial-deal' && guard < 20) {
      guard += 1;
      const mid = dealNextInitialCardOnState(state);
      if (mid.blackjack!.status === 'initial-deal') {
        expect(mid.blackjack!.activeHandKey).toBeNull();
      }
      state = mid;
    }

    expect(state.blackjack!.status).not.toBe('initial-deal');
    if (!state.blackjack!.insuranceOfferPending) {
      expect(state.blackjack!.activeHandKey).not.toBeNull();
    }
  });

  it('reveal steps match engine plan when hole is dealt face-down', () => {
    let state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(readyOneBox()));
    const round = state.blackjack!;
    expect(round.dealerCardIds[1]).toBeTruthy();
    expect(round.dealerHoleHidden).toBe(true);

    const enginePlan = buildInitialDealPlan(state.session, round);
    const revealPlan = buildInitialRevealSteps(round);
    expect(revealPlan).toEqual(enginePlan);
    expect(revealPlan[revealPlan.length - 1]).toEqual({ type: 'dealer', cardIndex: 1 });
  });

  it('deal sequence UI order matches engine plan for three boxes', () => {
    const state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(readyThreeBoxes()));
    const round = state.blackjack!;
    const handKeys = handKeysWithConfirmedBets(state.session, round);
    const engineSteps = buildInitialDealPlanFromHandKeys(handKeys);
    const uiSteps = buildInitialDealSequence(state.session, round);
    expect(uiSteps.map((s) => (s.type === 'dealer' ? `D${s.cardIndex}` : `${s.handKey}:${s.cardIndex}`))).toEqual(
      engineSteps.map((s) => (s.type === 'dealer' ? `D${s.cardIndex}` : `${s.handKey}:${s.cardIndex}`)),
    );
  });

  it('ordered reveal applies when player-turns state arrives before UI catch-up', () => {
    expect(
      shouldUseOrderedInitialReveal('player-turns', { dealer: 0, hands: {} }, { dealer: 2, hands: { 'p:0': 2 } }),
    ).toBe(true);
    expect(
      shouldUseOrderedInitialReveal('bank-turn', { dealer: 0, hands: {} }, { dealer: 2, hands: { 'p:0': 2 } }),
    ).toBe(true);
    expect(
      shouldUseOrderedInitialReveal('bank-turn', { dealer: 1, hands: {} }, { dealer: 3, hands: {} }),
    ).toBe(false);
  });

  it('mid-round hydrate does not replay reveal steps', () => {
    const state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(readyOneBox()));
    const scope = `${state.session.id}:${state.session.currentRound}`;
    expect(shouldHydrateCardRevealScope(null, scope, false)).toBe(true);
    expect(shouldHydrateCardRevealScope(scope, scope, true)).toBe(false);
    const target = maxVisibilityForRound(state.blackjack);
    const hydrated = applyCardVisibility(state, target);
    expect(hydrated.blackjack!.dealerCardIds.filter(Boolean)).toHaveLength(2);
  });

  it('stepwise deal gives every box a first card before any box receives a second', () => {
    let state = beginInitialDealOnState(readyThreeBoxes());
    const handKeys = state.blackjack!.initialDealHandKeys ?? [];
    const counts: Record<string, number> = Object.fromEntries(handKeys.map((k) => [k, 0]));

    let guard = 0;
    while (state.blackjack?.status === 'initial-deal' && guard < 20) {
      guard += 1;
      const result = dealNextInitialCard(
        state.session,
        state.players,
        state.deck!,
        state.blackjack!,
        state.blackjackSettings,
      );
      if (result.step.type === 'box') {
        counts[result.step.handKey] = (counts[result.step.handKey] ?? 0) + 1;
        const idx = handKeys.indexOf(result.step.handKey);
        const expectedCount = result.step.cardIndex + 1;
        for (let i = 0; i < handKeys.length; i += 1) {
          expect(counts[handKeys[i]!]).toBe(i <= idx ? expectedCount : result.step.cardIndex);
        }
      }
      state = { ...state, ...result, blackjack: result.round };
    }
  });
});
