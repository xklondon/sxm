import type { GameState } from '../../../types';
import type { BlackjackRound } from '../../../types/blackjack';
import type { Deck } from '../../../types/deck';
import { getCardDealDelayMs } from '../flowSettings';
import { isStagedInitialDeal } from './dealingModes';
import { buildInitialDealPlanFromHandKeys } from '../initialDeal';
import type { InitialDealStep } from '../initialDeal';
import { cardsFromIds, getBlackjackHandValue } from '../hand';

export interface CardVisibilityCounts {
  dealer: number;
  hands: Record<string, number>;
}

export function emptyCardVisibility(): CardVisibilityCounts {
  return { dealer: 0, hands: {} };
}

/** How reveal hydration should react when table/round scope changes. */
export function resolveRevealScopeTransition(
  previousScope: string | null,
  nextScope: string,
): 'hydrate' | 'reset' | 'continue' {
  if (!previousScope) {
    return 'reset';
  }
  const prevTable = previousScope.split(':')[0] ?? '';
  const nextTable = nextScope.split(':')[0] ?? '';
  if (prevTable !== nextTable) {
    return 'hydrate';
  }
  if (previousScope !== nextScope) {
    return 'reset';
  }
  return 'continue';
}

/** True when visible counts reference a different hand set than the authoritative round. */
export function isStaleHandVisibility(
  visible: CardVisibilityCounts,
  target: CardVisibilityCounts,
): boolean {
  for (const key of Object.keys(visible.hands)) {
    if (!(key in target.hands)) {
      return true;
    }
  }
  return false;
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

export function isActiveHandRevealComplete(
  round: BlackjackRound | null | undefined,
  visible: CardVisibilityCounts,
  handKey: string | null | undefined,
): boolean {
  if (!round || !handKey) {
    return false;
  }
  const hand = round.playerHands[handKey];
  if (!hand) {
    return false;
  }
  const targetCount = hand.cardIds.filter(Boolean).length;
  if (targetCount === 0) {
    return false;
  }
  const visibleCount = visible.hands[handKey] ?? 0;
  return visibleCount >= targetCount;
}

/** Player controls may enable once the active hand or full table reveal has caught up. */
export function isActionRevealReady(
  pacedReveal: boolean,
  options: { cardRevealComplete: boolean; activeHandRevealComplete: boolean },
): boolean {
  if (!pacedReveal) {
    return true;
  }
  return options.cardRevealComplete || options.activeHandRevealComplete;
}

/** Visible card ids for a hand in the current display round (masked or full). */
export function getVisibleHandCardIds(
  round: BlackjackRound | null | undefined,
  handKey: string,
): string[] {
  return (round?.playerHands[handKey]?.cardIds ?? []).filter(Boolean);
}

/**
 * Hand total from visible cards only — totals must never lead card reveal.
 * Returns null when no visible cards exist yet.
 */
export function getDisplayedHandValue(
  deck: Deck | null | undefined,
  round: BlackjackRound | null | undefined,
  handKey: string,
): number | null {
  if (!deck) {
    return null;
  }
  const ids = getVisibleHandCardIds(round, handKey);
  if (ids.length === 0) {
    return null;
  }
  return getBlackjackHandValue(cardsFromIds(deck, ids)).value;
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

/**
 * First mount on a paced table: snap only when joining mid-round (cards already in play).
 * Fresh natural initial deals must start from empty visibility and step P→D→P→D.
 */
export function shouldSnapCardRevealOnMount(state: GameState): boolean {
  if (state.tableMeta.gameStatus === 'ended') {
    return true;
  }
  const round = state.blackjack;
  if (!round) {
    return false;
  }
  const target = maxVisibilityForRound(round);
  if (totalCardCount(target) === 0) {
    return false;
  }
  if (
    round.status === 'bank-turn' ||
    round.status === 'banking' ||
    round.status === 'resolved'
  ) {
    return true;
  }
  if (round.status === 'player-turns' || round.insuranceOfferPending) {
    if (target.dealer > 2) {
      return true;
    }
    for (const count of Object.values(target.hands)) {
      if (count > 2) {
        return true;
      }
    }
    return false;
  }
  return false;
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
  if (isStaleHandVisibility(visible, target)) {
    return totalCardCount(target) > 0;
  }
  if (visible.dealer < target.dealer) {
    return true;
  }
  for (const [handKey, targetCount] of Object.entries(target.hands)) {
    if ((visible.hands[handKey] ?? 0) < targetCount) {
      return true;
    }
  }
  return totalCardCount(target) > totalCardCount(visible);
}

/** Ordered initial-deal reveal while catching up the first two cards per hand. */
export function shouldUseOrderedInitialReveal(
  _roundStatus: BlackjackRound['status'] | undefined,
  visible: CardVisibilityCounts,
  target: CardVisibilityCounts,
): boolean {
  if (!hasPendingCardReveal(visible, target) || !isInitialDealVisibilityCounts(target)) {
    return false;
  }
  return true;
}

/** Next paced reveal step — ordered initial deal, then gameplay catch-up. */
export function nextSequentialRevealStep(
  visible: CardVisibilityCounts,
  target: CardVisibilityCounts,
  round: BlackjackRound | null,
  roundStatus: BlackjackRound['status'] | undefined,
): CardVisibilityCounts | null {
  if (isStaleHandVisibility(visible, target)) {
    return null;
  }
  if (round && shouldUseOrderedInitialReveal(roundStatus, visible, target)) {
    const steps = buildInitialRevealSteps(round);
    for (const step of steps) {
      const after = applyRevealStep(visible, step);
      if (
        after.dealer !== visible.dealer ||
        Object.keys(after.hands).some(
          (handKey) => (after.hands[handKey] ?? 0) !== (visible.hands[handKey] ?? 0),
        )
      ) {
        if (totalCardCount(after) <= totalCardCount(target)) {
          return after;
        }
      }
    }
  }
  if (hasPendingCardReveal(visible, target)) {
    return nextGameplayRevealStep(visible, target);
  }
  return null;
}

/** True when the next reveal step is the first card on a hand after another hand already has cards. */
export function isHandBoundaryRevealStep(
  visible: CardVisibilityCounts,
  stepped: CardVisibilityCounts,
): boolean {
  for (const [handKey, nextCount] of Object.entries(stepped.hands)) {
    const prevCount = visible.hands[handKey] ?? 0;
    if (prevCount === 0 && nextCount > 0) {
      const otherHandsStarted = Object.entries(visible.hands).some(
        ([key, count]) => key !== handKey && count > 0,
      );
      if (otherHandsStarted) {
        return true;
      }
    }
  }
  return false;
}

/** Pick deal-speed vs bank-timer delay for the next sequential reveal step. */
export function resolveCardRevealDelayMs(
  state: Pick<GameState, 'blackjackFlowSettings'>,
  round: NonNullable<GameState['blackjack']> | null,
  roundStatus: NonNullable<GameState['blackjack']>['status'] | undefined,
  visible: CardVisibilityCounts,
  target: CardVisibilityCounts,
): number {
  if (isStagedInitialDeal(state.blackjackFlowSettings.initialDealMode)) {
    return 0;
  }
  if (round && shouldUseOrderedInitialReveal(roundStatus, visible, target)) {
    return getCardDealDelayMs(state, 'initial-deal');
  }
  const step = nextGameplayRevealStep(visible, target);
  if (!step) {
    return getCardDealDelayMs(state, 'initial-deal');
  }
  if (step.dealer > visible.dealer) {
    if (roundStatus === 'bank-turn' || roundStatus === 'banking') {
      return getCardDealDelayMs(state, 'bank-card-draw');
    }
    return getCardDealDelayMs(state, 'dealer');
  }
  return getCardDealDelayMs(state, 'hit');
}
