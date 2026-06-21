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

import {
  MOBILE_LANDSCAPE_MAX_HEIGHT,
  MOBILE_LANDSCAPE_MAX_WIDTH,
  MOBILE_LAYOUT_MEDIA_LANDSCAPE,
  MOBILE_MAX_WIDTH,
} from '../styles/mobileLayoutContract';

// ── Freeze flags (see BLACKJACK_LAYOUT_CONTRACTS.md) ─────────────────────────

export const FULL_TABLE_DESKTOP_FROZEN = true as const;
export const FULL_TABLE_MOBILE_PORTRAIT_FROZEN = true as const;
export const FULL_TABLE_MOBILE_LANDSCAPE_FROZEN = true as const;
export const CARD_VIEW_DESKTOP_FROZEN = true as const;
export const CARD_VIEW_MOBILE_PORTRAIT_FROZEN = true as const;
export const CARD_VIEW_MOBILE_LANDSCAPE_FROZEN = false as const;

/** Engine + layout baseline freeze — see docs/BLACKJACK_ENGINE_FREEZE.md */
export const BLACKJACK_ENGINE_FROZEN = true as const;
export const BLACKJACK_ENGINE_FREEZE_DOC = 'docs/BLACKJACK_ENGINE_FREEZE.md' as const;

/** @deprecated Use FULL_TABLE_MOBILE_PORTRAIT_FROZEN — alias for existing tests. */
export const FULL_TABLE_MOBILE_FROZEN = FULL_TABLE_MOBILE_PORTRAIT_FROZEN;

/** True only when all Card View sub-views (C1–C3) are frozen. */
export const CARD_VIEW_FROZEN =
  CARD_VIEW_DESKTOP_FROZEN &&
  CARD_VIEW_MOBILE_PORTRAIT_FROZEN &&
  CARD_VIEW_MOBILE_LANDSCAPE_FROZEN;

export const BLACKJACK_LAYOUT_CONTRACT_DOC = 'docs/BLACKJACK_LAYOUT_CONTRACTS.md' as const;

/** Reference screenshot for desktop Full Table freeze. */
export const FULL_TABLE_DESKTOP_REFERENCE_IMAGE =
  'reference-ui/views/a_digital_blackjack_poker_style_casino_game_ui_scr.png' as const;

/** Reference screenshot for canonical desktop Full Table + Card View layout. */
export const DESKTOP_CANONICAL_LAYOUT_REFERENCE_IMAGE =
  'reference-ui/views/Mobil.png' as const;

/** Token-based desktop layout knobs — scoped under desktop view roots only. */
export const DESKTOP_LAYOUT_TOKENS = [
  '--bj-desktop-player-row-spread',
  '--bj-desktop-box-value-scale',
  '--bj-desktop-cardview-hero-value-scale',
  '--bj-desktop-action-row-offset',
  '--bj-desktop-card-area-bottom-gap',
] as const;

// ── View roots ───────────────────────────────────────────────────────────────

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

/** Card View root class aliases (audit naming). */
export const CARD_VIEW_DESKTOP_ROOT = CARD_VIEW_DESKTOP_VIEW_ROOT;
export const CARD_VIEW_MOBILE_ROOT = CARD_VIEW_MOBILE_VIEW_ROOT;

// ── Media / orientation boundaries ───────────────────────────────────────────

/**
 * Portrait mobile Full Table — sync with Contract C in bj-player-row-layout.css.
 * JS mobile detection: MOBILE_LAYOUT_MEDIA + MOBILE_MAX_WIDTH in mobileLayoutContract.ts.
 */
export const FULL_TABLE_MOBILE_PORTRAIT_MEDIA =
  `(max-width: ${MOBILE_MAX_WIDTH}px) and (orientation: portrait), ((max-width: ${MOBILE_LANDSCAPE_MAX_WIDTH}px) and (max-height: ${MOBILE_LANDSCAPE_MAX_HEIGHT}px) and (pointer: coarse) and (orientation: portrait))` as const;

/** Landscape mobile Full Table — sync with MOBILE_LAYOUT_MEDIA_LANDSCAPE. */
export const FULL_TABLE_MOBILE_LANDSCAPE_MEDIA = MOBILE_LAYOUT_MEDIA_LANDSCAPE;

/** Documented risk: landscape tokens appear in two blocks in bj-table-shared.css. */
export const FULL_TABLE_MOBILE_LANDSCAPE_TOKEN_SOURCES = [
  'src/styles/bj-table-shared.css',
] as const;

/** Known duplicate landscape @media selectors to consolidate before B2 freeze. */
export const FULL_TABLE_MOBILE_LANDSCAPE_MEDIA_BLOCKS = [
  '@media (orientation: landscape)',
  '@media (min-width: 721px) and (orientation: landscape)',
] as const;

// ── Card View layout markers ─────────────────────────────────────────────────

export const CARD_VIEW_CARDS_AREA_MODE = 'hero' as const;
export const CARD_VIEW_CARDS_AREA_CLASS = 'bj-cards-area--hero';
export const FULL_TABLE_CARDS_AREA_CLASS = 'bj-cards-area--table';

/** All views — canonical Hit/Stay via shell BlackjackActionRow only (no Card View side-action path). */
export const CARD_VIEW_CANONICAL_SHELL_ACTIONS_ONLY = true as const;

/** @deprecated Mobile side Stay/Hit removed — shell BlackjackActionPanel is canonical for all views. */
export const CARD_VIEW_MOBILE_DUAL_ACTION_PATH_DOCUMENTED = false as const;

export const CARD_VIEW_MOBILE_SIDE_ACTION_CLASS = 'bj-phone-view__side-action';

/** In-box hand total during play — all views; chips hidden in box during play. */
export const PLAYER_BOX_IN_PLAY_HAND_VALUE_CLASS = 'bj-phone-view__mini-hand-value' as const;

/** Card View hero total below cards — dealer-value emphasis token. */
export const CARD_VIEW_HERO_VALUE_CLASS = 'bj-card-view__hero-value' as const;
/** Card View hero third+ cards — offset/layered over readable first two. */
export const CARD_VIEW_HERO_LAYERED_CARD_WRAP_CLASS = 'bj-phone-view__card-wrap--layered' as const;

/** Card View shell vertical order (matches BlackjackTableLayoutShell). */
export const CARD_VIEW_SHELL_VERTICAL_ORDER = [
  'bj-table-info-bar--felt-row',
  'bj-dealer-area',
  'bj-table-zone--summary',
  'bj-cards-area--hero',
  'bj-table-zone--actions',
  'bj-table-zone--boxes',
  'bj-table-zone--bottom',
] as const;

/** Desktop shared shell grid row names (bank-info + play bands). */
export const DESKTOP_SHELL_GRID_ROWS = [
  'bank-info',
  'dealer',
  'command',
  'cards',
  'actions',
  'boxes',
  'tray',
] as const;

/** @deprecated Use DESKTOP_SHELL_GRID_ROWS — hero value lives inside cards area. */
export const CARD_VIEW_DESKTOP_GRID_ROWS = DESKTOP_SHELL_GRID_ROWS;

// ── Full Table layout markers ─────────────────────────────────────────────────

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

/** Desktop optional Double/Split overlay anchor in cards zone (not the Hit/Stay row). */
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

/** Reference screenshot for canonical desktop Card View layout. */
export const CARD_VIEW_DESKTOP_REFERENCE_IMAGE =
  'reference-ui/views/Desktop_Card.png' as const;

/** Desktop Card View layout tokens — scoped under .bj-view-card-desktop only. */
export const CARD_VIEW_DESKTOP_LAYOUT_TOKENS = [
  '--bj-card-desktop-box-spread',
  '--bj-card-desktop-box-value-scale',
] as const;

/** Card View mobile portrait layout owner (portrait @media only). */
export const CARD_VIEW_MOBILE_PORTRAIT_LAYOUT_OWNER_FILES = [
  'src/styles/bj-card-mobile-portrait-layout.css',
] as const;

/** Full Table mobile landscape layout owner. */
export const FULL_TABLE_MOBILE_LANDSCAPE_LAYOUT_OWNER_FILES = [
  'src/styles/bj-full-mobile-landscape-layout.css',
] as const;

/** Shared table shell — sole owner for structural zone layout (all views). */
export const BLACKJACK_TABLE_SHELL_LAYOUT_OWNER_FILES = [
  'src/styles/bj-blackjack-table-shell.css',
] as const;

/** Card View layout owner — Cards Area hero internals only (desktop). */
export const CARD_VIEW_LAYOUT_OWNER_FILES = [
  'src/styles/bj-card-desktop-hero-area.css',
  'src/styles/bj-card-desktop-layout.css',
] as const;

/** Recommended freeze order (docs + guards only until each flag is true). */
export const LAYOUT_FREEZE_RECOMMENDED_ORDER = [
  'FULL_TABLE_MOBILE_LANDSCAPE',
  'CARD_VIEW_DESKTOP',
  'CARD_VIEW_MOBILE_PORTRAIT',
  'CARD_VIEW_MOBILE_LANDSCAPE',
] as const;

/** Canonical shell zone order for Full Table (matches BlackjackTableLayoutShell DOM). */
export const FULL_TABLE_SHELL_ZONE_ORDER = [
  'bank-info',
  'dealer',
  'command',
  'cards',
  'actions',
  'boxes',
  'tray',
] as const;

/** Gameplay bands after optional bank-info row — dealer → command → cards → actions → boxes → tray. */
export const FULL_TABLE_GAMEPLAY_ZONE_ORDER = [
  'dealer',
  'command',
  'cards',
  'actions',
  'boxes',
  'tray',
] as const;

/** Shell zone CSS classes in DOM order (after bank info header inside felt). */
export const FULL_TABLE_SHELL_ZONE_CLASSES = [
  'bj-dealer-area',
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
    id: 'card-zone-overflow-x-hidden-pair',
    description: 'overflow-x: hidden on desktop card zone (without paired clip fix) regresses stacks',
    pattern:
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*overflow-x:\s*hidden/,
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
  '--bj-desktop-actions-boxes-gap',
  '--bj-full-desktop-stack-value-gap',
  '--bj-desktop-dealer-command-gap',
] as const;

/** Production shell component — sole Blackjack zone owner (Full Table + Card View). */
export const BLACKJACK_TABLE_LAYOUT_SHELL_NAME = 'BlackjackTableLayoutShell' as const;

/** Layout CSS cascade version — reported by ?layoutDebug=1. */
export const BLACKJACK_CSS_LAYOUT_ROUTE_VERSION = 'shell-owner-v2' as const;

/**
 * Deterministic global CSS import order for blackjack table styles (mirrors src/index.css).
 * Shell geometry: bj-blackjack-table-shell.css (after shared tokens + card-area play zone).
 */
export const CANONICAL_BLACKJACK_CSS_IMPORT_ORDER = [
  'src/styles/tokens.css',
  'src/styles/sxm-stitch-visual.css',
  'src/styles/bj-table-shared.css',
  'src/styles/bj-player-row-layout.css',
  'src/styles/bj-card-layout.css',
  'src/styles/bj-full-table-card-area.css',
  'src/styles/bj-felt-skins.css',
  'src/styles/bj-blackjack-table-shell.css',
  'src/styles/bj-card-desktop-hero-area.css',
  'src/styles/bj-card-desktop-layout.css',
  'src/styles/bj-card-mobile-portrait-layout.css',
  'src/styles/bj-full-mobile-landscape-layout.css',
  'src/styles/bj-mobile-landscape-layout.css',
  'src/styles/bj-blackjack-targeted-fixes.css',
  'src/styles/bj-layout-debug.css',
  'src/styles/design-system.css',
  'src/styles/mobile-modals.css',
  'src/styles/bj-card-mobile-hero-final.css',
] as const;
