import { describe, expect, it } from 'vitest';
import { createNewBlackjackTable } from '../session';
import { claimBoxSlot } from '../session/boxOps';
import {
  getChipPlacementTarget,
  getChipPlacementTargetFromBoxId,
  placeBetPayloadFromTarget,
  resolveChipTrayBetTarget,
} from './chipPlacement';

describe('getChipPlacementTarget', () => {
  it('returns boxId when the slot is occupied', () => {
    let state = createNewBlackjackTable();
    state = claimBoxSlot(state, 1);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    expect(getChipPlacementTarget(state, { slotNumber: 1 })).toEqual({
      kind: 'box',
      boxId,
    });
    expect(placeBetPayloadFromTarget(getChipPlacementTarget(state, { slotNumber: 1 }), 10)).toEqual({
      boxId,
      amount: 10,
    });
  });

  it('returns slotNumber for an empty slot', () => {
    const state = createNewBlackjackTable();
    expect(getChipPlacementTarget(state, { slotNumber: 3 })).toEqual({
      kind: 'slot',
      slotNumber: 3,
    });
    expect(placeBetPayloadFromTarget(getChipPlacementTarget(state, { slotNumber: 3 }), 5)).toEqual({
      slotNumber: 3,
      amount: 5,
    });
  });
});

describe('getChipPlacementTargetFromBoxId (online)', () => {
  it('uses boxId when the box is on the table', () => {
    let state = createNewBlackjackTable();
    state = claimBoxSlot(state, 1);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    expect(getChipPlacementTargetFromBoxId(state, boxId, true)).toEqual({
      kind: 'box',
      boxId,
    });
  });

  it('throws Box not found for an unknown boxId online', () => {
    const state = createNewBlackjackTable();
    expect(() => getChipPlacementTargetFromBoxId(state, 'client-only-box-id', true)).toThrow(
      /Box not found/,
    );
  });

  it('falls back to slotNumber when boxId maps to an empty slot (stale local materialization)', () => {
    const state = createNewBlackjackTable();
    const localBoxId = 'local-box-uuid';
    const ownerId = state.tableMeta.ownerPersonId!;
    const staleState = {
      ...state,
      players: {
        ...state.players,
        [localBoxId]: {
          id: localBoxId,
          displayName: 'Box 1',
          controllerName: 'Host',
          role: 'box' as const,
          bankrollOwnerId: ownerId,
          playerType: 'real' as const,
          startingBalance: 0,
          currentBet: 0,
          cardIds: [],
          status: 'active' as const,
        },
      },
      session: {
        ...state.session,
        boxSlotNumbers: { ...state.session.boxSlotNumbers, [localBoxId]: 1 },
      },
    };
    expect(getChipPlacementTargetFromBoxId(staleState, localBoxId, true)).toEqual({
      kind: 'slot',
      slotNumber: 1,
    });
  });
});

describe('resolveChipTrayBetTarget', () => {
  it('prefers selectedSeatId when server-backed', () => {
    let state = createNewBlackjackTable();
    state = claimBoxSlot(state, 2);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 2)!.playerId!;
    state = { ...state, selectedSeatId: boxId };
    const target = resolveChipTrayBetTarget(state, 'Host', null, true);
    expect(target).toEqual({ kind: 'box', boxId });
  });

  it('uses last slot target when selection is empty', () => {
    const state = createNewBlackjackTable();
    const target = resolveChipTrayBetTarget(
      state,
      'Host',
      { kind: 'slot', slotNumber: 1 },
      true,
    );
    expect(target).toEqual({ kind: 'slot', slotNumber: 1 });
  });
});
