import { useEffect, useState } from 'react';

import {
  MOBILE_LAYOUT_MEDIA,
  MOBILE_MAX_WIDTH,
} from '../styles/mobileLayoutContract';

export {
  MOBILE_LAYOUT_MEDIA,
  MOBILE_MAX_WIDTH,
  isMobileLayoutViewport,
} from '../styles/mobileLayoutContract';

/**
 * Below this width the curved Full Table felt cannot render usefully, so we fall
 * back to a "Use Card View" hint. Normal phones (>= 360) render the canonical
 * (mobile-optimized) Full Table — never the fallback.
 */
export const ULTRA_NARROW_MAX_WIDTH = 359;

/** Width-only check — prefer isMobileLayoutViewport for device classification. */
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

const ULTRA_NARROW_QUERY = `(max-width: ${ULTRA_NARROW_MAX_WIDTH}px)`;

function matchesMobileLayout(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOBILE_LAYOUT_MEDIA).matches;
}

/** Reactive mobile layout flag — portrait width or short coarse-pointer landscape. */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(matchesMobileLayout);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia(MOBILE_LAYOUT_MEDIA);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      mq.removeEventListener('change', handler);
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
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
