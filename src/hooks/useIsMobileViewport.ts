import { useEffect, useState } from 'react';

/**
 * Single source of truth for the device boundary. Widths at or below this are
 * treated as mobile (phone) layouts. 720 matches the existing accounts-panel /
 * accounts-button breakpoint so JS and CSS agree on one device class.
 */
export const MOBILE_MAX_WIDTH = 720;

/**
 * Below this width the curved Full Table felt cannot render usefully, so we fall
 * back to a "Use Card View" hint. Normal phones (>= 360) render the canonical
 * (mobile-optimized) Full Table — never the fallback.
 */
export const ULTRA_NARROW_MAX_WIDTH = 359;

export function isMobileViewportWidth(width: number): boolean {
  return width <= MOBILE_MAX_WIDTH;
}

export function isUltraNarrowViewportWidth(width: number): boolean {
  return width <= ULTRA_NARROW_MAX_WIDTH;
}

/**
 * Full Table felt is replaced by the "Use Card View" fallback ONLY on
 * ultra-narrow widths (< 360px). All normal phone widths render the real
 * (mobile-optimized) Full Table — same component/structure as desktop.
 */
export function shouldShowMobileFullTableFallback(
  isUltraNarrow: boolean,
  viewMode: 'full' | 'card',
): boolean {
  return isUltraNarrow && viewMode === 'full';
}

const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;
const ULTRA_NARROW_QUERY = `(max-width: ${ULTRA_NARROW_MAX_WIDTH}px)`;

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

function matchesUltraNarrow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(ULTRA_NARROW_QUERY).matches;
}

/** Reactive ultra-narrow flag (< 360px) — gates the Full Table fallback only. */
export function useIsUltraNarrowViewport(): boolean {
  const [isUltraNarrow, setIsUltraNarrow] = useState(matchesUltraNarrow);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia(ULTRA_NARROW_QUERY);
    const handler = () => setIsUltraNarrow(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isUltraNarrow;
}
