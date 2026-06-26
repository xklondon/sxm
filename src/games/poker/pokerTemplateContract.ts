/**
 * Visual contract for Poker production UI.
 * Source: reference-ui/Poker/stitch_professional_casino_poker_redesign (DESIGN.md + screen.png)
 * — "High Roller Protocol" stitch professional casino poker redesign.
 */
export const POKER_TEMPLATE_REFERENCE_PATH =
  'reference-ui/Poker/stitch_professional_casino_poker_redesign';

export const POKER_TEMPLATE_REFERENCE_FILES = [
  `${POKER_TEMPLATE_REFERENCE_PATH}/DESIGN.md`,
  `${POKER_TEMPLATE_REFERENCE_PATH}/screen.png`,
] as const;

/** Root shell — dark premium session wrapper. */
export const POKER_TEMPLATE_SHELL = 'poker-hr-shell';

/** Compact live-session header. */
export const POKER_TEMPLATE_TOPBAR = 'poker-hr-topbar';

/** Oval felt stage containing seats + center play area. */
export const POKER_TEMPLATE_STAGE = 'poker-hr-stage';

/** Rounded/oval table surface. */
export const POKER_TEMPLATE_TABLE = 'poker-hr-table';

/** Arc cloth title integrated into felt. */
export const POKER_TEMPLATE_CLOTH = 'poker-hr-cloth';

/** Seat ring around the oval. */
export const POKER_TEMPLATE_SEAT_RING = 'poker-hr-seat-ring';

/** Center stack: pot, community, deal control. */
export const POKER_TEMPLATE_CENTER = 'poker-hr-center';

/** Table-integrated deal / start control. */
export const POKER_TEMPLATE_DEAL_BTN = 'poker-hr-deal-btn';

/** Casino action bar below the table. */
export const POKER_TEMPLATE_ACTION_BAR = 'poker-hr-action-bar';
