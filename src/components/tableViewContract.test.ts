import { describe, expect, it } from 'vitest';
import {
  cardViewShowsSidePanelColumn,
  getCardViewBettingLayout,
  getDeviceView,
  getViewRootClass,
  preserveClientViewMode,
  resolveInitialViewMode,
  showStatusCornerBox,
} from './tableViewContract';
import { shouldShowMobileFullTableFallback } from '../hooks/useIsMobileViewport';
import {
  getBetBoxPulseClassName,
  getBoxCardClassName,
  BOX_CARD_ACTIVE,
} from './cardViewBox';

describe('view roots (no leak between views)', () => {
  it('desktop Full Table uses the full-desktop root, not the card root', () => {
    expect(getViewRootClass(getDeviceView(false), 'full')).toBe('bj-view-full-desktop');
    expect(getViewRootClass(getDeviceView(false), 'full')).not.toBe('bj-view-card-desktop');
  });

  it('desktop Card View uses the card-desktop root, not the full root', () => {
    expect(getViewRootClass(getDeviceView(false), 'card')).toBe('bj-view-card-desktop');
    expect(getViewRootClass(getDeviceView(false), 'card')).not.toBe('bj-view-full-desktop');
  });

  it('mobile roots are distinct from desktop roots', () => {
    expect(getViewRootClass(getDeviceView(true), 'full')).toBe('bj-view-full-mobile');
    expect(getViewRootClass(getDeviceView(true), 'card')).toBe('bj-view-card-mobile');
  });
});

describe('mobile Full Table is fallback-only', () => {
  it('shows fallback only for mobile + full', () => {
    expect(shouldShowMobileFullTableFallback(true, 'full')).toBe(true);
    expect(shouldShowMobileFullTableFallback(true, 'card')).toBe(false);
    expect(shouldShowMobileFullTableFallback(false, 'full')).toBe(false);
  });
});

describe('mobile Card View has no side-panel column', () => {
  it('only desktop renders the right side panel column', () => {
    expect(cardViewShowsSidePanelColumn('mobile')).toBe(false);
    expect(cardViewShowsSidePanelColumn('desktop')).toBe(true);
  });
});

describe('view mode is client-local (no flip on server update)', () => {
  it('preserves the local mode across an incoming server/placeBet update', () => {
    expect(preserveClientViewMode('card')).toBe('card');
    expect(preserveClientViewMode('full')).toBe('full');
  });

  it('defaults to Card View on mobile and keeps persisted choice on desktop', () => {
    expect(resolveInitialViewMode(true, 'full')).toBe('card');
    expect(resolveInitialViewMode(true, null)).toBe('card');
    expect(resolveInitialViewMode(false, 'card')).toBe('card');
    expect(resolveInitialViewMode(false, null)).toBe('full');
  });
});

describe('betting Card View — desktop ordered row, no center placeholder', () => {
  it('uses an ordered row on desktop and hero+secondary on mobile', () => {
    expect(getCardViewBettingLayout(false)).toBe('ordered-row');
    expect(getCardViewBettingLayout(true)).toBe('hero-secondary');
  });

  it('owned betting boxes pulse from current state', () => {
    expect(getBetBoxPulseClassName(true, true)).not.toBe('');
    expect(getBetBoxPulseClassName(false, true)).toBe('');
  });
});

describe('playing Card View — active box highlight', () => {
  it('active box gets the highlight class, inactive does not', () => {
    expect(getBoxCardClassName(true)).toContain(BOX_CARD_ACTIVE);
    expect(getBoxCardClassName(false)).not.toContain(BOX_CARD_ACTIVE);
  });
});

describe('status corner box does not alter Card View status on mobile', () => {
  it('corner box is desktop-only; mobile keeps its own status layout', () => {
    expect(showStatusCornerBox('desktop')).toBe(true);
    expect(showStatusCornerBox('mobile')).toBe(false);
  });
});
