import { describe, expect, it } from 'vitest';
import {
  BET_BOX_PULSE,
  BOX_CARD_ACTIVE,
  BOX_CARD_BASE,
  getBetBoxPulseClassName,
  getBoxCardClassName,
  getBoxCardValueLabel,
} from './cardViewBox';

describe('cardViewBox helpers', () => {
  describe('getBoxCardValueLabel', () => {
    it('renders BUST for busted hands regardless of total', () => {
      expect(getBoxCardValueLabel(22, 'bust')).toBe('BUST');
      expect(getBoxCardValueLabel(26, 'bust')).toBe('BUST');
    });

    it('renders the numeric total prominently when playing', () => {
      expect(getBoxCardValueLabel(19, 'playing')).toBe('19');
      expect(getBoxCardValueLabel(17, 'stood')).toBe('17');
    });

    it('renders nothing when there is no hand value yet', () => {
      expect(getBoxCardValueLabel(null, 'betting')).toBe('');
      expect(getBoxCardValueLabel(0, 'waiting')).toBe('');
    });
  });

  describe('getBoxCardClassName', () => {
    it('adds the active highlight class only for the active box', () => {
      expect(getBoxCardClassName(true)).toContain(BOX_CARD_ACTIVE);
      expect(getBoxCardClassName(false)).not.toContain(BOX_CARD_ACTIVE);
      expect(getBoxCardClassName(false)).toBe(BOX_CARD_BASE);
    });
  });

  describe('getBetBoxPulseClassName', () => {
    it('pulses owned boxes while betting is open', () => {
      expect(getBetBoxPulseClassName(true, true)).toBe(BET_BOX_PULSE);
    });

    it('does not pulse open seats or when betting closed', () => {
      expect(getBetBoxPulseClassName(true, false)).toBe('');
      expect(getBetBoxPulseClassName(false, true)).toBe('');
    });

    it('is deterministic so the pulse survives re-renders / WebSocket updates', () => {
      const first = getBetBoxPulseClassName(true, true);
      const afterUpdate = getBetBoxPulseClassName(true, true);
      expect(afterUpdate).toBe(first);
      expect(afterUpdate).toBe(BET_BOX_PULSE);
    });
  });
});
