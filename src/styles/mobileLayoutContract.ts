/**
 * Canonical mobile layout boundary — keep MOBILE_LAYOUT_MEDIA in sync with
 * `@media` blocks in bj-table-shared.css and bj-card-layout.css.
 */
export const MOBILE_MAX_WIDTH = 720;

/** Short landscape phones (e.g. iPhone rotated) can exceed portrait width. */
export const MOBILE_LANDSCAPE_MAX_WIDTH = 960;
export const MOBILE_LANDSCAPE_MAX_HEIGHT = 520;

/** CSS @media list for mobile blackjack shell + shared tokens. */
export const MOBILE_LAYOUT_MEDIA = `(max-width: ${MOBILE_MAX_WIDTH}px), ((max-width: ${MOBILE_LANDSCAPE_MAX_WIDTH}px) and (max-height: ${MOBILE_LANDSCAPE_MAX_HEIGHT}px) and (pointer: coarse))`;

export const MOBILE_LAYOUT_MEDIA_LANDSCAPE = `(max-width: ${MOBILE_MAX_WIDTH}px) and (orientation: landscape), ((max-width: ${MOBILE_LANDSCAPE_MAX_WIDTH}px) and (max-height: ${MOBILE_LANDSCAPE_MAX_HEIGHT}px) and (pointer: coarse) and (orientation: landscape))`;

export function isMobileLayoutViewport(
  width: number,
  height: number,
  options?: { coarsePointer?: boolean },
): boolean {
  if (width <= MOBILE_MAX_WIDTH) {
    return true;
  }
  const coarsePointer = options?.coarsePointer ?? true;
  return (
    coarsePointer &&
    width <= MOBILE_LANDSCAPE_MAX_WIDTH &&
    height <= MOBILE_LANDSCAPE_MAX_HEIGHT
  );
}
