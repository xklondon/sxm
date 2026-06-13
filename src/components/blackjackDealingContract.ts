/**
 * Dealing boundary — canonical reveal queue + value visibility rules.
 * UI must not maintain a second reveal path; use useSequentialCardReveal only.
 */
export type { SequentialCardRevealOptions } from '../hooks/useSequentialCardReveal';

export {
  applyCardVisibility,
  applyRevealStep,
  buildInitialRevealSteps,
  emptyCardVisibility,
  getDisplayedHandValue,
  getVisibleHandCardIds,
  isActionRevealReady,
  isActiveHandRevealComplete,
  maxVisibilityForRound,
  resolveRevealScopeTransition,
  shouldSnapCardRevealOnMount,
} from '../engine/blackjack/dealing/cardRevealDisplay';

export { getVisibleDealerCardIds } from '../engine/blackjack/protocolState';

export { isInstantInitialDeal, isNaturalInitialDeal, isPacedCardReveal } from '../engine/blackjack/dealing/dealingModes';

export { canShowPlayerDecisionControls } from './blackjackViewPhase';

import type { GameState } from '../types';
import { cardsFromIds, getBlackjackHandValue } from '../engine/blackjack/hand';
import { getDisplayedHandValue as getHandValueFromVisibleCards } from '../engine/blackjack/dealing/cardRevealDisplay';
import { getVisibleDealerCardIds as dealerCardIdsFromDisplayState } from '../engine/blackjack/protocolState';

/** Dealer hand total from display state only — null until visible cards exist. */
export function resolveDealerDisplayValue(displayState: GameState): number | null {
  const round = displayState.blackjack;
  const deck = displayState.deck;
  if (!round || !deck) {
    return null;
  }
  let cardIds = dealerCardIdsFromDisplayState(displayState);
  const holeHidden =
    round.dealerHoleHidden &&
    round.status !== 'resolved' &&
    round.status !== 'bank-turn' &&
    round.status !== 'banking';
  if (holeHidden && cardIds.length > 1) {
    cardIds = cardIds.slice(0, 1);
  }
  if (cardIds.length === 0) {
    return null;
  }
  if (cardIds.length === 1) {
    return getBlackjackHandValue(cardsFromIds(deck, cardIds)).value;
  }
  return getBlackjackHandValue(cardsFromIds(deck, cardIds)).value;
}

/** Player hand total from display state only. */
export function resolveHandDisplayValue(
  displayState: GameState,
  handKey: string,
): number | null {
  return getHandValueFromVisibleCards(displayState.deck, displayState.blackjack, handKey);
}

/** Sole hook entry for paced card reveal in React views. */
export const DEALING_REVEAL_HOOK = 'useSequentialCardReveal';

/** Files allowed to orchestrate reveal pacing. */
export const DEALING_REVEAL_OWNER_FILES = [
  'src/hooks/useSequentialCardReveal.ts',
  'src/components/BlackjackPanel.tsx',
  'src/components/BlackjackCardView.tsx',
] as const;
