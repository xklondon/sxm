/**
 * Layout boundary — view roots, Full Table frozen contracts, slot-order rules.
 * Canonical doc: docs/BLACKJACK_LAYOUT_CONTRACTS.md
 */
export {
  getDeviceView,
  getViewRootClass,
  preserveClientViewMode,
  resolveInitialViewMode,
  sortBoxSlotsForCardViewDisplay,
  sortBoxSlotsForTableVisualOrder,
  type DeviceView,
} from './tableViewContract';

export { TABLE_UX } from './tableUxContract';

/** Frozen layout flags — update only with explicit contract + test changes. */
export const FULL_TABLE_DESKTOP_FROZEN = true as const;
export const FULL_TABLE_MOBILE_FROZEN = true as const;
/** Card View layout is not frozen yet — see docs/BLACKJACK_LAYOUT_CONTRACTS.md §C. */
export const CARD_VIEW_FROZEN = false as const;

export const BLACKJACK_LAYOUT_CONTRACT_DOC = 'docs/BLACKJACK_LAYOUT_CONTRACTS.md' as const;

/** Reference screenshot for desktop Full Table freeze. */
export const FULL_TABLE_DESKTOP_REFERENCE_IMAGE =
  'reference-ui/views/a_digital_blackjack_poker_style_casino_game_ui_scr.png' as const;

/** Canonical view root class prefixes — all view CSS must scope under one of these. */
export const VIEW_ROOT_CLASSES = [
  'bj-view-full-desktop',
  'bj-view-card-desktop',
  'bj-view-full-mobile',
  'bj-view-card-mobile',
] as const;

export const FULL_TABLE_DESKTOP_VIEW_ROOT = 'bj-view-full-desktop' as const;
export const FULL_TABLE_MOBILE_VIEW_ROOT = 'bj-view-full-mobile' as const;
export const CARD_VIEW_DESKTOP_VIEW_ROOT = 'bj-view-card-desktop' as const;
export const CARD_VIEW_MOBILE_VIEW_ROOT = 'bj-view-card-mobile' as const;

/** Active turn highlight — tight numeric frame only (no box/card-stack oval). */
export const ACTIVE_HAND_VALUE_CLASS = 'bj-phone-view__box-value--active-turn';

/** Deprecated box turn border — must not appear during player turn. */
export const DEPRECATED_BOX_TURN_CLASS = 'bj-box--turn';

/** Panel files that own arc card/box slot rendering. */
export const LAYOUT_SLOT_OWNER_FILES = ['src/components/BlackjackPanel.tsx'] as const;

/** Full Table card row between command box and actions row — see bj-full-table-card-area.css */
export const FULL_TABLE_CARD_AREA_CLASS = 'bj-full-table-card-area';

/** DOM stack host inside card column — grid row 2 (wraps vertical stack; see renderArcCardStack). */
export const FULL_TABLE_CARD_STACK_HOST_CLASS = 'bj-arc__play-zone';

/**
 * Full Table card column — canonical three-zone grid between command box and player boxes.
 * Row 1: outcome marker (reserved height). Row 2: stack grows upward. Row 3: fixed value band (bottom).
 * Applies to `.bj-view-full-desktop` and `.bj-view-full-mobile` only (not Card View).
 */
export const FULL_TABLE_CARD_COLUMN_CLASS = 'bj-arc__slot--card-column';

/** Card column value band — always below stack (grid row 3). */
export const FULL_TABLE_CARD_VALUE_CLASS = 'bj-phone-view__box-value--card-column-below';

/** Desktop optional Double/Split overlay anchor in cards zone. */
export const FULL_TABLE_OPTIONAL_PLAY_OVERLAY_ANCHOR_CLASS = 'bj-optional-play-overlay-anchor';

/** Full Table play zone CSS — command, card area, actions (imported last among table layout CSS). */
export const FULL_TABLE_PLAY_ZONE_CSS = 'src/styles/bj-full-table-card-area.css' as const;

/** @deprecated alias — use FULL_TABLE_PLAY_ZONE_CSS */
export const FULL_TABLE_CARD_AREA_CSS = FULL_TABLE_PLAY_ZONE_CSS;

/** Files allowed to own Full Table card/action layout geometry. */
export const FULL_TABLE_LAYOUT_OWNER_FILES = [
  FULL_TABLE_PLAY_ZONE_CSS,
  'src/components/blackjackLayoutContract.ts',
  'src/components/BlackjackPanel.tsx',
  'src/components/BlackjackTableLayoutShell.tsx',
  'src/components/OptionalPlayDecisionOverlay.css',
  'src/components/InsuranceDecisionOverlay.css',
] as const;

/** CSS files that must not define competing Full Table card-column grid layout. */
export const FULL_TABLE_LAYOUT_GUARDED_CSS_FILES = [
  'src/styles/bj-table-shared.css',
  'src/styles/bj-card-layout.css',
  'src/styles/bj-player-row-layout.css',
  'src/components/BlackjackPanel.css',
] as const;

/** Card View sources that must not override Full Table layout classes. */
export const CARD_VIEW_LAYOUT_GUARD_FILES = [
  'src/components/BlackjackCardView.tsx',
  'src/styles/bj-card-layout.css',
] as const;

/** Canonical shell zone order for Full Table (matches BlackjackTableLayoutShell DOM). */
export const FULL_TABLE_SHELL_ZONE_ORDER = [
  'dealer',
  'command',
  'cards',
  'actions',
  'boxes',
  'tray',
] as const;

/** Shell zone CSS classes in DOM order (after bank info header inside felt). */
export const FULL_TABLE_SHELL_ZONE_CLASSES = [
  'bj-table-zone--dealer',
  'bj-table-zone--summary',
  'bj-table-zone--cards',
  'bj-table-zone--actions',
  'bj-table-zone--boxes',
  'bj-table-zone--bottom',
] as const;

/** Panel function that owns the sole Full Table Hit/Stay render path. */
export const FULL_TABLE_ACTIONS_RENDER_FN = 'renderActionsContent' as const;

/** Primary actions row in Full Table actions zone (frozen desktop). */
export const FULL_TABLE_ACTION_ROW_PRIMARY_BUTTONS = ['Stay', 'Hit'] as const;

/** Optional play overlay buttons — compact; not in primary Hit/Stay row on desktop. */
export const FULL_TABLE_OPTIONAL_PLAY_OVERLAY_BUTTONS = ['Double', 'Split', 'Play Hand'] as const;

/** Optional play overlay button CSS — must stay smaller chrome than Hit/Stay. */
export const FULL_TABLE_OPTIONAL_PLAY_BUTTON_CLASS = 'bj-insurance-overlay__btn';

/** Primary Hit/Stay button classes in Full Table actions zone. */
export const FULL_TABLE_PRIMARY_HIT_CLASS = 'ds-btn--hit';
export const FULL_TABLE_PRIMARY_STAND_CLASS = 'ds-btn--stand';

/** AID is hidden on frozen desktop Full Table (mobile Full Table + Card View unchanged). */
export const FULL_TABLE_DESKTOP_AID_VISIBLE = false as const;

/** Forbidden inside CardsArea for Full Table — actions belong in bj-table-zone--actions only. */
export const FULL_TABLE_FORBIDDEN_CARD_AREA_ACTION_MARKERS = [
  'bj-table-actions',
  'bj-player-actions',
  'ds-btn--hit',
  'ds-btn--stand',
] as const;

/** CSS patterns that must not reappear in Full Table layout (regression guards). */
export const FULL_TABLE_FORBIDDEN_LAYOUT_PATTERNS = [
  {
    id: 'card-zone-vertical-center',
    description: 'Card zone must not vertically center stacks (justify-content: center on card area)',
    pattern:
      /\.bj-view-full-(?:desktop|mobile) \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*justify-content:\s*center/,
  },
  {
    id: 'card-zone-overflow-clip-pair',
    description: 'overflow-x: hidden + overflow-y: visible causes internal scrollbars',
    pattern:
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*overflow-x:\s*hidden[\s\S]*overflow-y:\s*visible/,
  },
  {
    id: 'card-zone-overflow-hidden',
    description: 'Full Table card zone must not clip stacks',
    pattern:
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*overflow:\s*hidden/,
  },
  {
    id: 'card-column-flex-grow-stack',
    description: 'Stack host must not flex-grow inside column',
    pattern:
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__slot--card-column > \.bj-arc__play-zone\s*\{[^}]*[^-]flex:\s*1\s+1\s+auto/,
  },
] as const;

export const FULL_TABLE_CARD_COLUMN_OUTCOME_ZONE_HEIGHT =
  'var(--bj-full-table-card-outcome-zone-height, 0.72rem)';

export const FULL_TABLE_CARD_COLUMN_GRID_ROWS = [
  FULL_TABLE_CARD_COLUMN_OUTCOME_ZONE_HEIGHT,
  'var(--bj-full-table-card-stack-zone-height)',
  'var(--bj-box-value-band-height)',
] as const;

/** View roots that use FULL_TABLE_CARD_COLUMN_GRID_ROWS. */
export const FULL_TABLE_CARD_COLUMN_VIEW_ROOTS = [
  FULL_TABLE_DESKTOP_VIEW_ROOT,
  FULL_TABLE_MOBILE_VIEW_ROOT,
] as const;

/** Desktop-only polish tokens — must stay under min-width 721px + bj-view-full-desktop. */
export const FULL_TABLE_DESKTOP_POLISH_TOKENS = [
  '--bj-full-desktop-actions-boxes-gap',
  '--bj-full-desktop-stack-value-gap',
  '--bj-full-desktop-dealer-command-gap',
] as const;
