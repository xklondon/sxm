import { describe, expect, it } from 'vitest';
import { claimBoxSlot } from '../engine/session/boxOps';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';
import { resolveControllerPersonId } from '../engine/session';
import type { GameState } from '../types';
import {
  affirmChipTargetAfterPlacement,
  createEmptyLocalChipTarget,
  getCurrentChipTargetForBetting,
  localChipTargetsEqual,
  reconcileLocalChipTarget,
  selectLocalChipTarget,
  type LocalSelectedChipTarget,
} from './localChipTargetSelection';

function simulatePanelReconcile(
  local: LocalSelectedChipTarget,
  gameState: GameState,
  online: boolean,
  bettingOpen: boolean,
): LocalSelectedChipTarget {
  let next = reconcileLocalChipTarget(local, gameState, online);
  if (bettingOpen && local.hasUserSelected && local.target) {
    if (!next.target) {
      next = { ...local, hasUserSelected: true };
    }
  } else if (next.hasUserSelected && next.target) {
    next = affirmChipTargetAfterPlacement(next, gameState, next.target, online);
  }
  if (next.hasUserSelected && !next.target && local.target) {
    return { ...next, target: local.target };
  }
  if (!localChipTargetsEqual(local, next)) {
    return next;
  }
  return local;
}

describe('repeat chip stacking — online server lag', () => {
  it('does not keep stale optimistic boxId when slot row is still empty', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const personId = resolveControllerPersonId(state, 'Alice')!;
    const staleBoxId = '00000000-0000-4000-8000-000000000002';

    const serverLag = {
      ...state,
      players: {
        ...state.players,
        [staleBoxId]: {
          id: staleBoxId,
          displayName: 'Box 2',
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
        boxSlotNumbers: { ...state.session.boxSlotNumbers, [staleBoxId]: 2 },
      },
    };

    const ref = selectLocalChipTarget(createEmptyLocalChipTarget(), {
      kind: 'box',
      boxId: staleBoxId,
    });

    const second = getCurrentChipTargetForBetting({
      ref,
      state: ref,
      gameState: serverLag,
      online: true,
      viewerPersonId: personId,
      visibleBoxCount: 4,
    });
    expect(second.ok, JSON.stringify(second)).toBe(true);
    if (second.ok) {
      expect(second.target).toEqual({ kind: 'slot', slotNumber: 2 });
    }
  });

  it('second tray tap survives server state without occupant on slot 2', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const personId = resolveControllerPersonId(state, 'Alice')!;

    let ref = selectLocalChipTarget(createEmptyLocalChipTarget(), {
      kind: 'slot',
      slotNumber: 2,
    });

    const optimistic = claimBoxSlot(state, 2);
    const box2 = boxPlayerId(optimistic, 2)!;
    const optimisticState = addChipToBoxStake(optimistic, box2, 5, personId);
    ref = affirmChipTargetAfterPlacement(ref, optimisticState, { kind: 'slot', slotNumber: 2 }, true);

    // Server broadcast arrives before claim is visible — slot 2 still empty.
    const serverLag = state;
    ref = simulatePanelReconcile(ref, serverLag, true, true);

    const second = getCurrentChipTargetForBetting({
      ref,
      state: ref,
      gameState: serverLag,
      online: true,
      viewerPersonId: personId,
      visibleBoxCount: 4,
    });
    expect(second.ok, JSON.stringify(second)).toBe(true);
  });
});
