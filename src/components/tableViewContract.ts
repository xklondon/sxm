import type { TableViewMode } from '../types';

/**
 * Strict view/layout contract for the blackjack table.
 *
 * Four canonical view roots (one class each) keep view-specific CSS from
 * leaking between Full Table and Card View on desktop and mobile:
 *   - bj-view-full-desktop  (reference full table)
 *   - bj-view-card-desktop  (ordered box row + active hero)
 *   - bj-view-full-mobile   (same felt subtree as desktop, mobile-optimized CSS;
 *                            the fallback only appears below 360px)
 *   - bj-view-card-mobile   (canonical mobile play view)
 *
 * View mode is CLIENT-LOCAL. Server/WebSocket state updates must never flip it.
 */
export type DeviceView = 'desktop' | 'mobile';

export function getDeviceView(isMobile: boolean): DeviceView {
  return isMobile ? 'mobile' : 'desktop';
}

export function getViewRootClass(device: DeviceView, viewMode: TableViewMode): string {
  return `bj-view-${viewMode}-${device}`;
}

/**
 * An explicit persisted choice is honored on every device (so a phone user who
 * selected Full Table stays in mobile Full Table). With no persisted choice,
 * mobile defaults to Card View and desktop to Full Table.
 */
export function resolveInitialViewMode(
  isMobile: boolean,
  persisted?: TableViewMode | null,
): TableViewMode {
  if (persisted === 'full' || persisted === 'card') {
    return persisted;
  }
  return isMobile ? 'card' : 'full';
}

/**
 * View mode is client-local: an incoming server state must not change it.
 * Returns the previously selected local mode unchanged.
 */
export function preserveClientViewMode(localMode: TableViewMode): TableViewMode {
  return localMode;
}

/** Desktop status corner styling is CSS-only (`.bj-view-*-desktop .bj-center-status`). */
export function showStatusCornerBox(device: DeviceView): boolean {
  return device === 'desktop';
}

/** This Table side column vs horizontal bar is CSS-only (view root classes). */
export function cardViewShowsSidePanelColumn(device: DeviceView): boolean {
  return device === 'desktop';
}
