import { describe, expect, it } from 'vitest';
import {
  applyDefaultAssignedChipTarget,
  createEmptyLocalChipTarget,
  getCurrentChipTargetForBetting,
  reconcileLocalChipTarget,
  resolveTraySlotFromLocalSelection,
  selectLocalChipTarget,
  uiFromLocalChipTarget,
  affirmChipTargetAfterPlacement,
} from './localChipTargetSelection';
import { resolvePlaceBetPayloadTarget } from './blackjackBoxPlacementContract';
import { addChipToBoxStake, getStakeForBox } from '../engine/blackjack/stakes';
import { createNewBlackjackTable } from '../engine/session';
import { claimBoxSlot } from '../engine/session/boxOps';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';

describe('localChipTargetSelection', () => {
  it('maps local slot target to UI pulse ids', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    expect(uiFromLocalChipTarget({ slotNumber: 3 }, state)).toEqual({
      selectedBettingBoxId: box3,
      selectedBettingSlotNumber: 3,
    });
    expect(uiFromLocalChipTarget({ slotNumber: 5 }, state)).toEqual({
      selectedBettingBoxId: null,
      selectedBettingSlotNumber: 5,
    });
  });

  it('applies assigned default only before user selection', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';

    const empty = createEmptyLocalChipTarget();
    const defaulted = applyDefaultAssignedChipTarget(empty, state, personId);
    expect(defaulted.hasUserSelected).toBe(false);
    expect(defaulted.target).toEqual({ slotNumber: 1 });

    const userPicked = selectLocalChipTarget(empty, 3);
    const blocked = applyDefaultAssignedChipTarget(userPicked, state, personId);
    expect(blocked).toEqual(userPicked);
  });

  it('resolves tray to explicit slot 3 after user selected', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);
    expect(resolveTraySlotFromLocalSelection(local, state, null)).toBe(3);
  });

  it('preserves slot anchor when box materializes offline', () => {
    let state = createNewBlackjackTable();
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 5);
    state = claimBoxSlot(state, 5);
    local = reconcileLocalChipTarget(local, state, false);
    expect(local.target).toEqual({ slotNumber: 5 });
    expect(local.hasUserSelected).toBe(true);
  });

  it('preserves user selection after chip placement state refresh', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const box3 = boxPlayerId(state, 3)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);
    state = addChipToBoxStake(state, box3, 10, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(local.hasUserSelected).toBe(true);
    expect(resolveTraySlotFromLocalSelection(local, state, personId)).toBe(3);
  });

  it('preserves slot when occupant transiently clears', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);
    const stripped = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((slot) =>
          slot.slotNumber === 3 ? { ...slot, playerId: null } : slot,
        ),
      },
    } as typeof state;
    const reconciled = reconcileLocalChipTarget(local, stripped, false);
    expect(reconciled.hasUserSelected).toBe(true);
    expect(reconciled.target).toEqual({ slotNumber: 3 });
    expect(resolveTraySlotFromLocalSelection(reconciled, stripped, null)).toBe(3);
  });

  it('keeps slot anchor when online slot occupant id rotates', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const oldBox = boxPlayerId(state, 3)!;
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);
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
    expect(reconciled.target).toEqual({ slotNumber: 3 });
    expect(uiFromLocalChipTarget(reconciled.target, rotated).selectedBettingBoxId).toBe(newBox);
  });

  it('repeat tray taps keep routing to the same slot after two chip placements', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const box3 = boxPlayerId(state, 3)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);

    state = addChipToBoxStake(state, box3, 10, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(resolveTraySlotFromLocalSelection(local, state, personId)).toBe(3);

    state = addChipToBoxStake(state, box3, 5, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(resolveTraySlotFromLocalSelection(local, state, personId)).toBe(3);
    expect(getStakeForBox(state, box3)).toBe(15);
  });

  it('online repeat tray taps on boxes 2–4 derive payload from slot', () => {
    for (const slotNumber of [2, 3, 4] as const) {
      let state = tableAfterStartPlaying(500);
      state = claimBoxSlot(state, slotNumber);
      const serverBoxId = boxPlayerId(state, slotNumber)!;
      const ownerId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
      let local = selectLocalChipTarget(createEmptyLocalChipTarget(), slotNumber);
      local = affirmChipTargetAfterPlacement(local, state, slotNumber, true);
      expect(resolvePlaceBetPayloadTarget(state, slotNumber, true, false)).toEqual({
        kind: 'box',
        boxId: serverBoxId,
      });
      state = addChipToBoxStake(state, serverBoxId, 5, ownerId);
      local = reconcileLocalChipTarget(local, state, true);
      expect(getCurrentChipTargetForBetting({
        ref: local,
        state: local,
        gameState: state,
        online: true,
        viewerPersonId: ownerId,
      })).toMatchObject({ ok: true, slotNumber });
    }
  });

  it('does not fall back to assigned slot after user selected another target', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);
    expect(resolveTraySlotFromLocalSelection(local, state, personId)).toBe(3);
  });
});
