import { describe, expect, it } from 'vitest';
import {
  applyDefaultAssignedChipTarget,
  createEmptyLocalChipTarget,
  reconcileLocalChipTarget,
  resolveTrayTargetFromLocalSelection,
  selectLocalChipTarget,
  uiFromLocalChipTarget,
} from './localChipTargetSelection';
import { addChipToBoxStake, getStakeForBox } from '../engine/blackjack/stakes';
import { createNewBlackjackTable } from '../engine/session';
import { claimBoxSlot } from '../engine/session/boxOps';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';

describe('localChipTargetSelection', () => {
  it('maps local target to UI pulse ids', () => {
    expect(uiFromLocalChipTarget({ kind: 'box', boxId: 'box-3' })).toEqual({
      selectedBettingBoxId: 'box-3',
      selectedBettingSlotNumber: null,
    });
    expect(uiFromLocalChipTarget({ kind: 'slot', slotNumber: 5 })).toEqual({
      selectedBettingBoxId: null,
      selectedBettingSlotNumber: 5,
    });
  });

  it('applies assigned default only before user selection', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const assigned = boxPlayerId(state, 1)!;
    const box3 = boxPlayerId(state, 3)!;

    const empty = createEmptyLocalChipTarget();
    const defaulted = applyDefaultAssignedChipTarget(empty, state, personId);
    expect(defaulted.hasUserSelected).toBe(false);
    expect(defaulted.target).toEqual({ kind: 'box', boxId: assigned });

    const userPicked = selectLocalChipTarget(empty, { kind: 'box', boxId: box3 });
    const blocked = applyDefaultAssignedChipTarget(userPicked, state, personId);
    expect(blocked).toEqual(userPicked);
  });

  it('resolves tray to explicit Box 3 after assigned default when user selected', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: box3 });
    expect(
      resolveTrayTargetFromLocalSelection(local, state, false, null),
    ).toEqual({ kind: 'box', boxId: box3 });
  });

  it('upgrades selected slot to materialized box instead of clearing', () => {
    let state = createNewBlackjackTable();
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'slot', slotNumber: 5 });
    state = claimBoxSlot(state, 5);
    const box5 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 5)!.playerId!;
    local = reconcileLocalChipTarget(local, state, false);
    expect(local.target).toEqual({ kind: 'box', boxId: box5 });
    expect(local.hasUserSelected).toBe(true);
  });

  it('preserves user selection after optimistic chip placement state refresh', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const box3 = boxPlayerId(state, 3)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: box3 });
    state = addChipToBoxStake(state, box3, 10, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(local.hasUserSelected).toBe(true);
    expect(resolveTrayTargetFromLocalSelection(local, state, false, personId)).toEqual({
      kind: 'box',
      boxId: box3,
    });
  });

  it('preserves user selection when reconcile cannot resolve target transiently', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: box3 });

    const stripped = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((slot) =>
          slot.playerId === box3 ? { ...slot, playerId: null } : slot,
        ),
      },
    } as typeof state;

    const reconciled = reconcileLocalChipTarget(local, stripped, false);
    expect(reconciled.hasUserSelected).toBe(true);
    expect(reconciled.target).toEqual({ kind: 'slot', slotNumber: 3 });
    expect(
      resolveTrayTargetFromLocalSelection(reconciled, stripped, false, null),
    ).toEqual({ kind: 'slot', slotNumber: 3 });
  });

  it('rebinds user-selected box when online slot occupant id rotates', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const oldBox = boxPlayerId(state, 3)!;
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: oldBox });
    const newBox = 'rotated-box-id';
    const rotated = {
      ...state,
      players: {
        ...state.players,
        [newBox]: { ...state.players[oldBox]!, id: newBox },
      },
      session: {
        ...state.session,
        boxSlotNumbers: { ...state.session.boxSlotNumbers, [oldBox]: 3, [newBox]: 3 },
        playerIds: [...state.session.playerIds.filter((id) => id !== oldBox), newBox],
      },
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((slot) =>
          slot.slotNumber === 3 ? { ...slot, playerId: newBox } : slot,
        ),
      },
    };
    const reconciled = reconcileLocalChipTarget(local, rotated, true);
    expect(reconciled.hasUserSelected).toBe(true);
    expect(reconciled.target).toEqual({ kind: 'box', boxId: newBox });
  });

  it('clears user selection only when the target row is genuinely removed', () => {
    let state = createNewBlackjackTable();
    state = claimBoxSlot(state, 5);
    const box5 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 5)!.playerId!;
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: box5 });
    const cleared = reconcileLocalChipTarget(
      local,
      {
        ...state,
        players: Object.fromEntries(
          Object.entries(state.players).filter(([id]) => id !== box5),
        ),
        session: {
          ...state.session,
          boxSlotNumbers: {},
        },
        tableMeta: {
          ...state.tableMeta,
          boxSlots: state.tableMeta.boxSlots.map((slot) =>
            slot.playerId === box5 ? { ...slot, playerId: null } : slot,
          ),
        },
      },
      false,
    );
    expect(cleared.target).toEqual({ kind: 'box', boxId: box5 });
    expect(cleared.hasUserSelected).toBe(true);
  });

  it('repeat tray taps keep routing to the same explicit box after two chip placements', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const nativeBox = boxPlayerId(state, 1)!;
    const box3 = boxPlayerId(state, 3)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: box3 });

    state = addChipToBoxStake(state, box3, 10, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(resolveTrayTargetFromLocalSelection(local, state, false, personId)).toEqual({
      kind: 'box',
      boxId: box3,
    });

    state = addChipToBoxStake(state, box3, 5, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(resolveTrayTargetFromLocalSelection(local, state, false, personId)).toEqual({
      kind: 'box',
      boxId: box3,
    });
    expect(getStakeForBox(state, box3)).toBe(15);
    expect(getStakeForBox(state, nativeBox)).toBe(0);
  });

  it('repeat tray taps keep routing to native box after two chip placements', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const nativeBox = boxPlayerId(state, 1)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: nativeBox });

    state = addChipToBoxStake(state, nativeBox, 10, personId);
    local = reconcileLocalChipTarget(local, state, false);
    state = addChipToBoxStake(state, nativeBox, 10, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(resolveTrayTargetFromLocalSelection(local, state, false, personId)).toEqual({
      kind: 'box',
      boxId: nativeBox,
    });
  });

  it('repeat tray taps keep routing to free box after two chip placements', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 3)?.bankrollOwnerId ?? '';
    const freeBox = boxPlayerId(state, 3)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: freeBox });

    state = addChipToBoxStake(state, freeBox, 10, personId);
    local = reconcileLocalChipTarget(local, state, false);
    state = addChipToBoxStake(state, freeBox, 10, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(resolveTrayTargetFromLocalSelection(local, state, false, personId)).toEqual({
      kind: 'box',
      boxId: freeBox,
    });
  });

  it('does not fall back to assigned box after user selected another target', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const box3 = boxPlayerId(state, 3)!;
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: box3 });
    expect(resolveTrayTargetFromLocalSelection(local, state, false, personId)).toEqual({
      kind: 'box',
      boxId: box3,
    });
  });
});
