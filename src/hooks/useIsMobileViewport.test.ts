import { describe, expect, it } from 'vitest';
import {
  isMobileViewportWidth,
  shouldShowMobileFullTableFallback,
  MOBILE_MAX_WIDTH,
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

describe('shouldShowMobileFullTableFallback', () => {
  it('shows fallback only on mobile Full Table', () => {
    expect(shouldShowMobileFullTableFallback(true, 'full')).toBe(true);
  });

  it('never shows fallback for Card View (mobile Card View untouched)', () => {
    expect(shouldShowMobileFullTableFallback(true, 'card')).toBe(false);
    expect(shouldShowMobileFullTableFallback(false, 'card')).toBe(false);
  });

  it('never shows fallback on desktop Full Table (desktop untouched)', () => {
    expect(shouldShowMobileFullTableFallback(false, 'full')).toBe(false);
  });
});
