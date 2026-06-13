import { describe, expect, it } from 'vitest';

import {
  getChipPlacementTarget,
  getChipPlacementTargetFromBoxId,
  placeBetPayloadFromTarget,
  resolveChipTrayBetTarget,
} from '../engine/blackjack/chipPlacement';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';

describe('mobile/desktop betting payload parity (shared helper)', () => {
  it('assigned box resolves to the same boxId payload on every view path', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;
    state = { ...state, selectedSeatId: boxId };

    const fromSlot = placeBetPayloadFromTarget(getChipPlacementTarget(state, { slotNumber: 1 }), 10);
    const fromBox = placeBetPayloadFromTarget(
      getChipPlacementTargetFromBoxId(state, boxId, true),
      10,
    );
    const fromTray = placeBetPayloadFromTarget(
      resolveChipTrayBetTarget(state, 'Alice', null, true)!,
      10,
    );

    expect(fromSlot).toEqual({ boxId, amount: 10 });
    expect(fromBox).toEqual(fromSlot);
    expect(fromTray).toEqual(fromSlot);
  });

  it('empty slot resolves to slotNumber payload (not a stale local boxId)', () => {
    const state = tableAfterStartPlaying(500);
    const localBoxId = '00000000-0000-4000-8000-000000000003';
    const staleState = {
      ...state,
      selectedSeatId: localBoxId,
      players: {
        ...state.players,
        [localBoxId]: {
          id: localBoxId,
          displayName: 'Box 3',
          controllerName: 'Alice',
          role: 'box' as const,
          bankrollOwnerId: state.tableMeta.ownerPersonId!,
          playerType: 'real' as const,
          startingBalance: 0,
          currentBet: 0,
          cardIds: [],
          status: 'active' as const,
        },
      },
      session: {
        ...state.session,
        boxSlotNumbers: { ...state.session.boxSlotNumbers, [localBoxId]: 3 },
      },
    };

    const target = getChipPlacementTarget(staleState, { slotNumber: 3 });
    expect(target).toEqual({ kind: 'slot', slotNumber: 3 });
    expect(placeBetPayloadFromTarget(target, 5)).toEqual({ slotNumber: 3, amount: 5 });
  });

  it('chip tray uses last valid empty-slot target when selection is stale', () => {
    const state = tableAfterStartPlaying(500);
    const target = resolveChipTrayBetTarget(
      state,
      'Alice',
      { kind: 'slot', slotNumber: 3 },
      true,
    );
    expect(target).toEqual({ kind: 'slot', slotNumber: 3 });
    expect(placeBetPayloadFromTarget(target!, 25)).toEqual({ slotNumber: 3, amount: 25 });
  });
});
