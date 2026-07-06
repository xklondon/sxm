import { describe, expect, it } from 'vitest';
import {
  applyRevealStep,
  buildInitialRevealSteps,
  nextGameplayRevealStep,
  nextSequentialRevealStep,
  shouldUseOrderedInitialReveal,
  type CardVisibilityCounts,
} from './cardRevealDisplay';
import { buildInitialDealPlanFromHandKeys } from '../initialDeal';
import { tableAfterStartPlaying, boxPlayerId } from '../sanity/fixtures';
import { claimBoxSlot } from '../../session/boxOps';
import { addChipToBoxStake } from '../stakes';
import { blackjackHandKey } from '../handKeys';
import {
  completeStepwiseInitialDealIfNeeded,
  dealCardsButtonOnState,
  shuffleToStartOnState,
} from '../gameState';
import { createBlackjackShoe, shuffleBlackjackShoe } from '../shoe';

function simulateOrderedReveal(
  round: NonNullable<ReturnType<typeof dealCardsButtonOnState>['blackjack']>,
  roundStatus: 'player-turns' | 'initial-deal',
): string[] {
  const target = {
    dealer: round.dealerCardIds.filter(Boolean).length,
    hands: Object.fromEntries(
      Object.entries(round.playerHands).map(([k, h]) => [
        k,
        h.cardIds.filter(Boolean).length,
      ]),
    ),
  };
  let visible: CardVisibilityCounts = { dealer: 0, hands: {} };
  const labels: string[] = [];
  const steps = buildInitialRevealSteps(round);
  let guard = 0;
  while (
    guard < 30 &&
    shouldUseOrderedInitialReveal(round, visible, target)
  ) {
    guard += 1;
    let nextVisible: CardVisibilityCounts | null = null;
    for (const step of steps) {
      const after = applyRevealStep(visible, step);
      const changed =
        after.dealer !== visible.dealer ||
        Object.keys(after.hands).some((k) => (after.hands[k] ?? 0) !== (visible.hands[k] ?? 0));
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

describe('natural reveal order', () => {
  it('does not reveal dealer cards before box cards when one card remains', () => {
    const visible = { dealer: 1, hands: { 'p:0': 1, 'p2:0': 2 } };
    const target = { dealer: 2, hands: { 'p:0': 2, 'p2:0': 2 } };
    expect(shouldUseOrderedInitialReveal('player-turns', visible, target)).toBe(true);
    const gameplay = nextGameplayRevealStep(visible, target);
    expect(gameplay?.dealer).toBe(1);
    expect(gameplay?.hands['p:0']).toBe(2);
    const round = {
      status: 'player-turns',
      dealerCardIds: ['d1', 'd2'],
      dealerHoleHidden: true,
      activeHandKey: 'p:0',
      activePlayerId: 'p',
      playerHands: {
        'p:0': { cardIds: ['a', 'b'], playerId: 'p', handIndex: 0, currentBet: 10, actionStatus: 'acting' },
        'p2:0': { cardIds: ['c', 'd'], playerId: 'p2', handIndex: 0, currentBet: 10, actionStatus: 'acting' },
      },
      initialDealHandKeys: ['p:0', 'p2:0'],
    } as unknown as import('../../../types/blackjack').BlackjackRound;
    const allPlayersDone = { dealer: 1, hands: { 'p:0': 2, 'p2:0': 2 } };
    const ordered = nextSequentialRevealStep(allPlayersDone, target, round, 'player-turns');
    expect(ordered?.dealer).toBe(2);
    expect(ordered?.hands['p:0']).toBe(2);
  });

  it('three-box deal reveal matches engine plan labels', () => {
    let state = tableAfterStartPlaying(500);
    for (const slot of [1, 3, 4]) {
      state = claimBoxSlot(state, slot);
    }
    const personId = state.tableMeta.ownerPersonId!;
    for (const slot of [1, 3, 4]) {
      state = addChipToBoxStake(state, boxPlayerId(state, slot)!, 50, personId);
    }
    state = shuffleToStartOnState(state);
    state = {
      ...state,
      deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'reveal-3box'),
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjackFlowSettings: { ...state.blackjackFlowSettings, initialDealMode: 'natural' },
    };
    state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const round = state.blackjack!;
    const handKeys = Object.keys(round.playerHands).filter((k) => round.playerHands[k]?.currentBet);
    const engineLabels = buildInitialDealPlanFromHandKeys(handKeys).map((s) =>
      s.type === 'dealer' ? `D${s.cardIndex}` : `${s.handKey}:${s.cardIndex}`,
    );
    const revealLabels = simulateOrderedReveal(round, 'player-turns');
    expect(revealLabels).toEqual(engineLabels);
    const firstDealer = revealLabels.findIndex((l) => l.startsWith('D'));
    expect(revealLabels.slice(0, firstDealer).every((l) => l.endsWith(':0'))).toBe(true);
  });

  it('one-box reveal: box1, dealer up, box2, dealer hole', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 50);
    state = shuffleToStartOnState(state);
    state = {
      ...state,
      deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'reveal-1box'),
      tableMeta: { ...state.tableMeta, bettingLocked: true },
    };
    state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const round = state.blackjack!;
    const handKey = blackjackHandKey(boxId, 0);
    const labels = simulateOrderedReveal(round, 'player-turns');
    expect(labels).toEqual([`${handKey}:0`, 'D0', `${handKey}:1`, 'D1']);
  });

  it('online bank-resolve jump keeps player cards before dealer catch-up', () => {
    const handKey = 'p:0';
    const round = {
      status: 'resolved',
      dealerCardIds: ['d1', 'd2', 'd3', 'd4'],
      dealerHoleHidden: false,
      activeHandKey: null,
      activePlayerId: null,
      playerHands: {
        [handKey]: {
          cardIds: ['a', 'b'],
          playerId: 'p',
          handIndex: 0,
          currentBet: 10,
          actionStatus: 'done',
        },
      },
      initialDealHandKeys: [handKey],
      insuranceOfferPending: false,
      evenMoneyOfferHandKey: null,
      splitCounts: {},
      outcomes: { [handKey]: 'win' },
      isSettled: true,
    } as unknown as import('../../../types/blackjack').BlackjackRound;
    const visible = { dealer: 0, hands: {} };
    const target = {
      dealer: 4,
      hands: { [handKey]: 2 },
    };
    expect(shouldUseOrderedInitialReveal(round, visible, target)).toBe(true);
    const step = nextSequentialRevealStep(visible, target, round, 'resolved');
    expect(step?.hands[handKey]).toBe(1);
    expect(step?.dealer).toBe(0);
  });
});
