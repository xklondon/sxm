/**
 * blackjackGameOverContract.ts — canonical Blackjack game-over UI route.
 *
 * All four table modes (desktopFull, desktopCard, mobileFull, mobileCard) use
 * exactly one centered GameOverActionOverlay modal. Side-rail / inline duplicates
 * are forbidden while game-over is active.
 */

export const BLACKJACK_GAME_OVER_CONTRACT_VERSION = 'game-over-canonical-v1' as const;

/** Sole game-over component for Blackjack tables. */
export const BLACKJACK_CANONICAL_GAME_OVER_COMPONENT = 'GameOverActionOverlay' as const;

/** Canonical layout — centered modal overlay (not side-rail inline). */
export const BLACKJACK_GAME_OVER_LAYOUT = 'overlay' as const;
