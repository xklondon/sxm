import { describe, expect, it } from 'vitest';
import { resolveMobileCardViewPlaySwipe } from './useMobileCardViewPlaySwipe';

describe('resolveMobileCardViewPlaySwipe', () => {
  it('maps swipe left to stand and swipe right to hit', () => {
    expect(resolveMobileCardViewPlaySwipe(-60, 4)).toBe('stand');
    expect(resolveMobileCardViewPlaySwipe(60, 4)).toBe('hit');
  });

  it('ignores short or mostly-vertical gestures', () => {
    expect(resolveMobileCardViewPlaySwipe(-20, 4)).toBeNull();
    expect(resolveMobileCardViewPlaySwipe(60, 80)).toBeNull();
  });
});
