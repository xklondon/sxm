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
