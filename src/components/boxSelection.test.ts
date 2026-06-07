import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BET_BOX_PULSE,
  getBoxActivePulseClassName,
  getBetBoxPulseClassName,
  resolveBoxBorderVisualState,
  isCardViewBettingBoxVisuallyAssigned,
} from './cardViewBox';
import { resolveChipTrayBetTarget } from '../engine/blackjack/chipPlacement';
import { createNewBlackjackTable } from '../engine/session';
import { claimBoxSlot } from '../engine/session/boxOps';

describe('box selection — single chip target', () => {
  it('resolveChipTrayBetTarget keeps selected box when set', () => {
    let state = createNewBlackjackTable();
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const nativeBox = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    const box3 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 3)!.playerId!;
    state = { ...state, selectedSeatId: box3 };
    const target = resolveChipTrayBetTarget(state, 'Host', null, false);
    expect(target).toEqual({ kind: 'box', boxId: box3 });
    expect(target?.kind === 'box' ? target.boxId : null).not.toBe(nativeBox);
  });

  it('does not fall through to native box when selectedSeatId is set', () => {
    let state = createNewBlackjackTable();
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const box3 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 3)!.playerId!;
    state = { ...state, selectedSeatId: box3 };
    const target = resolveChipTrayBetTarget(
      state,
      'Host',
      { kind: 'box', boxId: state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId! },
      false,
    );
    expect(target).toEqual({ kind: 'box', boxId: box3 });
  });

  it('uses pulse for selected box and keeps native border underneath', () => {
    const state = createNewBlackjackTable();
    const nativeBox = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.playerId ?? 'box-1';
    const selected = resolveBoxBorderVisualState({
      state: {
        ...state,
        tableMeta: {
          ...state.tableMeta,
          boxSlots: state.tableMeta.boxSlots.map((s) =>
            s.slotNumber === 1 ? { ...s, playerId: nativeBox, nativeAssignedPersonId: 'person-1' } : s,
          ),
        },
      },
      boxPlayerId: nativeBox,
      viewerPersonId: 'person-1',
      selectedBettingBoxId: nativeBox,
      bettingStage: true,
    });
    const nativeOnly = resolveBoxBorderVisualState({
      state: {
        ...state,
        tableMeta: {
          ...state.tableMeta,
          boxSlots: state.tableMeta.boxSlots.map((s) =>
            s.slotNumber === 1 ? { ...s, playerId: nativeBox, nativeAssignedPersonId: 'person-1' } : s,
          ),
        },
      },
      boxPlayerId: nativeBox,
      viewerPersonId: 'person-1',
      bettingStage: true,
    });
    expect(getBoxActivePulseClassName(selected)).toBe(BET_BOX_PULSE);
    expect(getBoxActivePulseClassName(nativeOnly)).toBe('');
    expect(getBetBoxPulseClassName(true, false)).toBe(BET_BOX_PULSE);
    expect(getBetBoxPulseClassName(false, true)).toBe(BET_BOX_PULSE);
  });

  it('pulse applies only to selected box during betting', () => {
    expect(getBetBoxPulseClassName(true, false)).toContain('pulse');
    expect(getBetBoxPulseClassName(false, false)).toBe('');
  });

  it('free box is not visually assigned until stake > 0', () => {
    const base = createNewBlackjackTable();
    const personId = 'person-1';
    const freeBox = 'free-box';
    const state = {
      ...base,
      tableMeta: {
        ...base.tableMeta,
        ownerPersonId: personId,
        boxSlots: base.tableMeta.boxSlots.map((s) =>
          s.slotNumber === 4
            ? { ...s, playerId: freeBox, nativeAssignedPersonId: null }
            : s,
        ),
        boxStakes: {},
      },
    } as typeof base;
    expect(isCardViewBettingBoxVisuallyAssigned(state, freeBox, 0, personId)).toBe(false);
    const staked = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxStakes: {
          [freeBox]: { amount: 10, callerPersonId: personId, chips: [10] },
        },
      },
    };
    expect(isCardViewBettingBoxVisuallyAssigned(staked, freeBox, 10, personId)).toBe(true);
  });

  it('Card View and Full Table share selectedBettingBoxId in BlackjackPanel', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toContain('selectedBettingBoxId');
    expect(src).toContain('selectedBettingBoxId={selectedBettingBoxIdForUi}');
    expect(src).not.toMatch(/effectiveBoxId\s*=\s*gameState\.selectedSeatId\s*\?\?\s*defaultBlackjackSeatId/);
    expect(src).not.toMatch(/function selectBox\(boxId: string\) \{[\s\S]*selectedSeatId: boxId/);
  });
});
