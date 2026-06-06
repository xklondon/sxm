import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import {
  BET_BOX_PULSE,
  BOX_CARD_ACTIVE,
  BOX_CARD_BASE,
  getBetBoxPulseClassName,
  getBoxCardClassName,
  getBoxCardValueLabel,
  isCardViewBettingBoxVisuallyAssigned,
  isCardViewBoxNativeForPerson,
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

  describe('isCardViewBettingBoxVisuallyAssigned', () => {
    const baseState = {
      tableMeta: {
        boxSlots: [
          { slotNumber: 1, playerId: 'native-box', nativeAssignedPersonId: 'person-1' },
          { slotNumber: 3, playerId: 'free-box', nativeAssignedPersonId: null },
        ],
        boxStakes: {
          'free-box': { amount: 10, callerPersonId: 'person-1', chips: [10] },
        },
      },
    } as unknown as GameState;

    it('treats native boxes as assigned without stake', () => {
      expect(isCardViewBoxNativeForPerson(baseState, 'native-box', 'person-1')).toBe(true);
      expect(isCardViewBettingBoxVisuallyAssigned(baseState, 'native-box', 0, 'person-1')).toBe(
        true,
      );
    });

    it('requires stake before a free box looks assigned', () => {
      expect(isCardViewBettingBoxVisuallyAssigned(baseState, 'free-box', 0, 'person-1')).toBe(
        false,
      );
      expect(isCardViewBettingBoxVisuallyAssigned(baseState, 'free-box', 10, 'person-1')).toBe(
        true,
      );
    });
  });
});
