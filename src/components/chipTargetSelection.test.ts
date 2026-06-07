import { describe, expect, it } from 'vitest';
import {
  isBoxChipTargetOnTable,
  resolveLocalChipTrayTarget,
  shouldClearExplicitChipTarget,
} from './chipTargetSelection';
import { createNewBlackjackTable } from '../engine/session';
import { claimBoxSlot } from '../engine/session/boxOps';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';

describe('chipTargetSelection', () => {
  it('resolves occupied box target from explicit local selection', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 5);
    const box5 = boxPlayerId(state, 5)!;
    const target = resolveLocalChipTrayTarget(state, {
      userPicked: true,
      explicit: { kind: 'box', boxId: box5 },
      online: false,
    });
    expect(target).toEqual({ kind: 'box', boxId: box5 });
  });

  it('does not fall back when user has not picked a target', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 5);
    const box5 = boxPlayerId(state, 5)!;
    state = { ...state, selectedSeatId: boxPlayerId(state, 1)! };
    expect(
      resolveLocalChipTrayTarget(state, {
        userPicked: false,
        explicit: null,
        online: false,
      }),
    ).toBeNull();
    expect(
      resolveLocalChipTrayTarget(state, {
        userPicked: true,
        explicit: { kind: 'box', boxId: box5 },
        online: false,
      })?.kind === 'box'
        ? (resolveLocalChipTrayTarget(state, {
            userPicked: true,
            explicit: { kind: 'box', boxId: box5 },
            online: false,
          }) as { kind: 'box'; boxId: string }).boxId
        : null,
    ).toBe(box5);
  });

  it('upgrades materialized empty slot to box target instead of clearing', () => {
    let state = createNewBlackjackTable();
    const target = resolveLocalChipTrayTarget(state, {
      userPicked: true,
      explicit: { kind: 'slot', slotNumber: 5 },
      online: false,
    });
    expect(target).toEqual({ kind: 'slot', slotNumber: 5 });

    state = claimBoxSlot(state, 5);
    const box5 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 5)!.playerId!;
    expect(
      resolveLocalChipTrayTarget(state, {
        userPicked: true,
        explicit: { kind: 'slot', slotNumber: 5 },
        online: false,
      }),
    ).toEqual({ kind: 'box', boxId: box5 });
    expect(
      shouldClearExplicitChipTarget(state, { kind: 'slot', slotNumber: 5 }, false),
    ).toBe(false);
  });

  it('clears only when slot row or box row is removed', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 5);
    const box5 = boxPlayerId(state, 5)!;
    expect(isBoxChipTargetOnTable(state, box5, false)).toBe(true);
    expect(
      shouldClearExplicitChipTarget(state, { kind: 'box', boxId: box5 }, false),
    ).toBe(false);
    expect(
      shouldClearExplicitChipTarget(state, { kind: 'slot', slotNumber: 99 }, false),
    ).toBe(true);
  });

  it('assigned box 1 and selected box 5 resolve independently', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 5);
    const nativeBox = boxPlayerId(state, 1)!;
    const box5 = boxPlayerId(state, 5)!;
    state = { ...state, selectedSeatId: nativeBox };
    const target = resolveLocalChipTrayTarget(state, {
      userPicked: true,
      explicit: { kind: 'box', boxId: box5 },
      online: false,
    });
    expect(target).toEqual({ kind: 'box', boxId: box5 });
    expect(target?.kind === 'box' ? target.boxId : null).not.toBe(nativeBox);
  });
});
