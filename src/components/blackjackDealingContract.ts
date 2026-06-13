/**
 * Dealing boundary — canonical reveal queue + value visibility rules.
 * UI must not maintain a second reveal path; use useSequentialCardReveal only.
 */
export type { SequentialCardRevealOptions } from '../hooks/useSequentialCardReveal';

export {
  applyCardVisibility,
  emptyCardVisibility,
  getDisplayedHandValue,
  getVisibleHandCardIds,
  isActionRevealReady,
  isActiveHandRevealComplete,
  maxVisibilityForRound,
  resolveRevealScopeTransition,
} from '../engine/blackjack/dealing/cardRevealDisplay';

export { getVisibleDealerCardIds } from '../engine/blackjack/protocolState';

export { isInstantInitialDeal, isNaturalInitialDeal, isPacedCardReveal } from '../engine/blackjack/dealing/dealingModes';

export { canShowPlayerDecisionControls } from './blackjackViewPhase';

/** Sole hook entry for paced card reveal in React views. */
export const DEALING_REVEAL_HOOK = 'useSequentialCardReveal';

/** Files allowed to orchestrate reveal pacing. */
export const DEALING_REVEAL_OWNER_FILES = [
  'src/hooks/useSequentialCardReveal.ts',
  'src/components/BlackjackPanel.tsx',
  'src/components/BlackjackCardView.tsx',
] as const;
