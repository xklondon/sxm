/** Dev-only layout zone overlay — enable with `?layoutDebug=1` in the URL. */
export const BLACKJACK_LAYOUT_DEBUG_PARAM = 'layoutDebug';

/** Local override — set true while tuning zones; never ship enabled. */
const BLACKJACK_LAYOUT_DEBUG_FORCE = false;

export function isBlackjackLayoutDebugEnabled(search = ''): boolean {
  if (BLACKJACK_LAYOUT_DEBUG_FORCE) {
    return true;
  }
  if (!search) {
    return false;
  }
  return new URLSearchParams(search).get(BLACKJACK_LAYOUT_DEBUG_PARAM) === '1';
}
