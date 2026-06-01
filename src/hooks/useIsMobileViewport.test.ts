import { describe, expect, it } from 'vitest';
import {
  isMobileViewportWidth,
  isUltraNarrowViewportWidth,
  shouldShowMobileFullTableFallback,
  MOBILE_MAX_WIDTH,
  ULTRA_NARROW_MAX_WIDTH,
} from './useIsMobileViewport';

describe('isMobileViewportWidth', () => {
  it('treats narrow widths as mobile', () => {
    expect(isMobileViewportWidth(320)).toBe(true);
    expect(isMobileViewportWidth(MOBILE_MAX_WIDTH)).toBe(true);
  });

  it('treats wide widths as desktop', () => {
    expect(isMobileViewportWidth(MOBILE_MAX_WIDTH + 1)).toBe(false);
    expect(isMobileViewportWidth(1280)).toBe(false);
  });
});

describe('isUltraNarrowViewportWidth', () => {
  it('only flags screens narrower than a normal phone (< 360px)', () => {
    expect(isUltraNarrowViewportWidth(320)).toBe(true);
    expect(isUltraNarrowViewportWidth(ULTRA_NARROW_MAX_WIDTH)).toBe(true);
    expect(isUltraNarrowViewportWidth(360)).toBe(false); // normal phone
    expect(isUltraNarrowViewportWidth(390)).toBe(false);
  });
});

describe('shouldShowMobileFullTableFallback', () => {
  it('shows the fallback only on ultra-narrow Full Table', () => {
    expect(shouldShowMobileFullTableFallback(true, 'full')).toBe(true);
  });

  it('never shows fallback for Card View', () => {
    expect(shouldShowMobileFullTableFallback(true, 'card')).toBe(false);
    expect(shouldShowMobileFullTableFallback(false, 'card')).toBe(false);
  });

  it('renders the real Full Table on normal phone widths (no fallback)', () => {
    expect(shouldShowMobileFullTableFallback(false, 'full')).toBe(false);
  });
});
