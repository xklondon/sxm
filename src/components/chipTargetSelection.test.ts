import { describe, expect, it } from 'vitest';
import {
  isBoxChipTargetOnTable,
  resolveLocalChipTrayTarget,
  resolveViewerAssignedBoxPlayerId,
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

  it('resolveViewerAssignedBoxPlayerId returns native occupied box', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const nativeBox = boxPlayerId(state, 1)!;
    expect(resolveViewerAssignedBoxPlayerId(state, personId)).toBe(nativeBox);
    expect(resolveViewerAssignedBoxPlayerId(state, 'unknown')).toBeNull();
  });

  it('online stale boxId on empty slot falls back to slotNumber target', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const staleBoxId = '00000000-0000-4000-8000-000000000003';
    state = {
      ...state,
      players: {
        ...state.players,
        [staleBoxId]: {
          id: staleBoxId,
          displayName: 'Box 3',
          controllerName: 'Alice',
          role: 'box' as const,
          bankrollOwnerId: personId,
          playerType: 'real' as const,
          startingBalance: 0,
          currentBet: 0,
          cardIds: [],
          status: 'active' as const,
        },
      },
      session: {
        ...state.session,
        boxSlotNumbers: { ...state.session.boxSlotNumbers, [staleBoxId]: 3 },
      },
    };
    expect(isBoxChipTargetOnTable(state, staleBoxId, true)).toBe(false);
    expect(
      resolveLocalChipTrayTarget(state, {
        userPicked: true,
        explicit: { kind: 'box', boxId: staleBoxId },
        online: true,
      }),
    ).toEqual({ kind: 'slot', slotNumber: 3 });
  });

  it('online box target survives slot mapping refresh', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 5);
    const box5 = boxPlayerId(state, 5)!;
    state = {
      ...state,
      session: {
        ...state.session,
        boxSlotNumbers: { ...state.session.boxSlotNumbers, [box5]: 5 },
      },
    };
    expect(
      resolveLocalChipTrayTarget(state, {
        userPicked: true,
        explicit: { kind: 'box', boxId: box5 },
        online: true,
      }),
    ).toEqual({ kind: 'box', boxId: box5 });
    expect(shouldClearExplicitChipTarget(state, { kind: 'box', boxId: box5 }, true)).toBe(false);
  });
});
