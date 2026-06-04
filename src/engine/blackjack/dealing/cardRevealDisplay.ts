import type { GameState } from '../../../types';
import type { BlackjackRound } from '../../../types/blackjack';
import { buildInitialDealPlanFromHandKeys } from '../initialDeal';
import type { InitialDealStep } from '../initialDeal';

export interface CardVisibilityCounts {
  dealer: number;
  hands: Record<string, number>;
}

export function countVisibleCards(round: BlackjackRound | null): CardVisibilityCounts {
  if (!round) {
    return { dealer: 0, hands: {} };
  }
  const hands: Record<string, number> = {};
  for (const [handKey, hand] of Object.entries(round.playerHands)) {
    hands[handKey] = hand.cardIds.filter(Boolean).length;
  }
  return {
    dealer: round.dealerCardIds.filter(Boolean).length,
    hands,
  };
}

export function totalCardCount(counts: CardVisibilityCounts): number {
  let n = counts.dealer;
  for (const v of Object.values(counts.hands)) {
    n += v;
  }
  return n;
}

function handKeysForRound(round: BlackjackRound): string[] {
  if (round.initialDealHandKeys?.length) {
    return round.initialDealHandKeys;
  }
  return Object.keys(round.playerHands);
}

/** True when visibility targets are still within the two-card initial deal. */
export function isInitialDealVisibilityCounts(target: CardVisibilityCounts): boolean {
  if (target.dealer > 2) {
    return false;
  }
  for (const count of Object.values(target.hands)) {
    if (count > 2) {
      return false;
    }
  }
  return true;
}

/** Steps to reveal when authoritative state already has all initial-deal cards. */
export function buildInitialRevealSteps(round: BlackjackRound): InitialDealStep[] {
  const handKeys = handKeysForRound(round);
  const holeLast = !round.dealerCardIds[1];
  return buildInitialDealPlanFromHandKeys(handKeys, holeLast);
}

function maskRound(round: BlackjackRound, counts: CardVisibilityCounts): BlackjackRound {
  const playerHands = { ...round.playerHands };
  for (const [handKey, hand] of Object.entries(playerHands)) {
    const visible = counts.hands[handKey] ?? 0;
    playerHands[handKey] = {
      ...hand,
      cardIds: hand.cardIds.slice(0, visible),
    };
  }
  return {
    ...round,
    dealerCardIds: round.dealerCardIds.slice(0, counts.dealer),
    playerHands,
  };
}

export function applyCardVisibility(
  state: GameState,
  counts: CardVisibilityCounts,
): GameState {
  if (!state.blackjack) {
    return state;
  }
  return {
    ...state,
    blackjack: maskRound(state.blackjack, counts),
  };
}

/** Apply one initial-deal step onto visibility counts. */
export function applyRevealStep(
  counts: CardVisibilityCounts,
  step: InitialDealStep,
): CardVisibilityCounts {
  if (step.type === 'dealer') {
    return { ...counts, dealer: step.cardIndex + 1 };
  }
  const prev = counts.hands[step.handKey] ?? 0;
  return {
    ...counts,
    hands: {
      ...counts.hands,
      [step.handKey]: Math.max(prev, step.cardIndex + 1),
    },
  };
}

export function countsFromRevealSteps(steps: InitialDealStep[]): CardVisibilityCounts {
  let counts: CardVisibilityCounts = { dealer: 0, hands: {} };
  for (const step of steps) {
    counts = applyRevealStep(counts, step);
  }
  return counts;
}

export function maxVisibilityForRound(round: BlackjackRound | null): CardVisibilityCounts {
  return countVisibleCards(round);
}

/** Stable key for per-table, per-round visual hydration. */
export function cardRevealScopeKey(sessionId: string, roundNumber: number): string {
  return `${sessionId}:${roundNumber}`;
}

export function shouldHydrateCardRevealScope(
  previousScope: string | null,
  nextScope: string,
  hasHydrated: boolean,
): boolean {
  return !hasHydrated || previousScope !== nextScope;
}

/** Reveal one gameplay card (hit, double, bank draw) toward target visibility. */
export function nextGameplayRevealStep(
  visible: CardVisibilityCounts,
  target: CardVisibilityCounts,
): CardVisibilityCounts | null {
  if (visible.dealer < target.dealer) {
    return { ...visible, dealer: visible.dealer + 1 };
  }
  const handKeys = [
    ...new Set([...Object.keys(visible.hands), ...Object.keys(target.hands)]),
  ];
  for (const handKey of handKeys) {
    const cur = visible.hands[handKey] ?? 0;
    const tgt = target.hands[handKey] ?? 0;
    if (cur < tgt) {
      return {
        ...visible,
        hands: { ...visible.hands, [handKey]: cur + 1 },
      };
    }
  }
  return null;
}

export function hasPendingCardReveal(
  visible: CardVisibilityCounts,
  target: CardVisibilityCounts,
): boolean {
  return totalCardCount(target) > totalCardCount(visible);
}

/** Ordered initial-deal reveal while catching up the first two cards per hand. */
export function shouldUseOrderedInitialReveal(
  roundStatus: BlackjackRound['status'] | undefined,
  visible: CardVisibilityCounts,
  target: CardVisibilityCounts,
): boolean {
  if (!hasPendingCardReveal(visible, target) || !isInitialDealVisibilityCounts(target)) {
    return false;
  }
  if (
    roundStatus === 'bank-turn' ||
    roundStatus === 'banking' ||
    roundStatus === 'resolved'
  ) {
    return false;
  }
  return true;
}
