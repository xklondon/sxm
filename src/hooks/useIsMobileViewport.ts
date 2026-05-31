import { useEffect, useState } from 'react';

/** Widths at or below this are treated as mobile (phone) layouts. */
export const MOBILE_MAX_WIDTH = 640;

export function isMobileViewportWidth(width: number): boolean {
  return width <= MOBILE_MAX_WIDTH;
}

/** Full Table felt must be replaced by the fallback on mobile width. */
export function shouldShowMobileFullTableFallback(
  isMobile: boolean,
  viewMode: 'full' | 'card',
): boolean {
  return isMobile && viewMode === 'full';
}

const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

function matchesMobile(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** Reactive mobile-viewport flag driven by matchMedia. SSR/no-window → false. */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(matchesMobile);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia(MOBILE_QUERY);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
