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

/**
 * Desktop Card View betting: a single ordered horizontal row of boxes
 * (Box 1, Box 2, …) with no large center placeholder.
 * Mobile Card View betting keeps its canonical hero + secondary layout.
 */
export function getCardViewBettingLayout(isMobile: boolean): 'ordered-row' | 'hero-secondary' {
  return isMobile ? 'hero-secondary' : 'ordered-row';
}

/** Desktop views show the top-left status corner box; mobile keeps its own status line. */
export function showStatusCornerBox(device: DeviceView): boolean {
  return device === 'desktop';
}

/** Only desktop renders "This Table" as a right side panel column; mobile is a bar below. */
export function cardViewShowsSidePanelColumn(device: DeviceView): boolean {
  return device === 'desktop';
}
