/**
 * Layout boundary — view roots and slot-order contracts.
 * Re-exports tableViewContract + layout UX constants used by tests.
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

/** Canonical view root class prefixes — all view CSS must scope under one of these. */
export const VIEW_ROOT_CLASSES = [
  'bj-view-full-desktop',
  'bj-view-card-desktop',
  'bj-view-full-mobile',
  'bj-view-card-mobile',
] as const;

/** Active turn highlight — tight numeric frame only (no box/card-stack oval). */
export const ACTIVE_HAND_VALUE_CLASS = 'bj-phone-view__box-value--active-turn';

/** Deprecated box turn border — must not appear during player turn. */
export const DEPRECATED_BOX_TURN_CLASS = 'bj-box--turn';

/** Panel files that own arc card/box slot rendering. */
export const LAYOUT_SLOT_OWNER_FILES = ['src/components/BlackjackPanel.tsx'] as const;

/** Full Table card row between command box and actions row — see bj-full-table-card-area.css */
export const FULL_TABLE_CARD_AREA_CLASS = 'bj-full-table-card-area';

/**
 * Full Table card column — canonical three-zone grid between command box and player boxes.
 * Row 1: outcome marker (reserved height). Row 2: stack grows upward. Row 3: fixed value band (bottom).
 * Applies to `.bj-view-full-desktop` and `.bj-view-full-mobile` only (not Card View).
 */
export const FULL_TABLE_CARD_COLUMN_CLASS = 'bj-arc__slot--card-column';

/** CSS file owning the Full Table card area contract (imported last among table layout CSS). */
export const FULL_TABLE_CARD_AREA_CSS = 'src/styles/bj-full-table-card-area.css' as const;

export const FULL_TABLE_CARD_COLUMN_OUTCOME_ZONE_HEIGHT =
  'var(--bj-full-table-card-outcome-zone-height, 0.72rem)';

export const FULL_TABLE_CARD_COLUMN_GRID_ROWS = [
  FULL_TABLE_CARD_COLUMN_OUTCOME_ZONE_HEIGHT,
  'var(--bj-full-table-card-stack-zone-height)',
  'var(--bj-box-value-band-height)',
] as const;

/** View roots that use FULL_TABLE_CARD_COLUMN_GRID_ROWS. */
export const FULL_TABLE_CARD_COLUMN_VIEW_ROOTS = [
  'bj-view-full-desktop',
  'bj-view-full-mobile',
] as const;
