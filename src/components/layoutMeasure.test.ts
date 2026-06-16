import { describe, expect, it } from 'vitest';
import {
  assertNoPairwiseOverlap,
  assertVerticalStack,
  type LayoutRect,
} from './layoutMeasure';

describe('layoutMeasure', () => {
  it('detects vertical stack order', () => {
    const cards: LayoutRect = { top: 0, bottom: 100, left: 0, right: 200, width: 200, height: 100 };
    const value: LayoutRect = { top: 104, bottom: 130, left: 0, right: 200, width: 200, height: 26 };
    const actions: LayoutRect = { top: 136, bottom: 180, left: 0, right: 200, width: 200, height: 44 };
    expect(() => assertVerticalStack([cards, value, actions])).not.toThrow();
  });

  it('fails when value overlaps cards', () => {
    const cards: LayoutRect = { top: 0, bottom: 100, left: 0, right: 200, width: 200, height: 100 };
    const value: LayoutRect = { top: 90, bottom: 120, left: 0, right: 200, width: 200, height: 30 };
    expect(() => assertVerticalStack([cards, value], { label: 'hero' })).toThrow(/hero/);
  });

  it('detects overlap between hero value and actions', () => {
    const value: LayoutRect = { top: 100, bottom: 140, left: 0, right: 200, width: 200, height: 40 };
    const actions: LayoutRect = { top: 130, bottom: 170, left: 0, right: 200, width: 200, height: 40 };
    expect(() => assertNoPairwiseOverlap([value, actions], { label: 'hero-value-actions' })).toThrow(
      /overlap/,
    );
  });
});
