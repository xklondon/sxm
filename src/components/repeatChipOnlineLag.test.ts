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
import { resolvePlaceBetPayloadTarget } from './blackjackBoxPlacementContract';

function simulatePanelReconcile(
  local: LocalSelectedChipTarget,
  gameState: GameState,
  online: boolean,
  bettingOpen: boolean,
): LocalSelectedChipTarget {
  let next = reconcileLocalChipTarget(local, gameState, online);
  if (bettingOpen && local.hasUserSelected && local.target) {
    next = affirmChipTargetAfterPlacement(
      { ...local, hasUserSelected: true },
      gameState,
      local.target.slotNumber,
      online,
    );
  }
  if (!localChipTargetsEqual(local, next)) {
    return next;
  }
  return local;
}

describe('repeat chip stacking — online server lag', () => {
  it('derives slot payload when empty slot selected online', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const personId = resolveControllerPersonId(state, 'Alice')!;

    const ref = selectLocalChipTarget(createEmptyLocalChipTarget(), 2);

    const second = getCurrentChipTargetForBetting({
      ref,
      state: ref,
      gameState: state,
      online: true,
      viewerPersonId: personId,
      visibleBoxCount: 4,
    });
    expect(second.ok, JSON.stringify(second)).toBe(true);
    if (second.ok) {
      expect(second.slotNumber).toBe(2);
      expect(resolvePlaceBetPayloadTarget(state, 2, true, false)).toEqual({
        kind: 'slot',
        slotNumber: 2,
      });
    }
  });

  it('second tray tap survives server state without occupant on slot 2', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const personId = resolveControllerPersonId(state, 'Alice')!;

    let ref = selectLocalChipTarget(createEmptyLocalChipTarget(), 2);

    const optimistic = claimBoxSlot(state, 2);
    const box2 = boxPlayerId(optimistic, 2)!;
    const optimisticState = addChipToBoxStake(optimistic, box2, 5, personId);
    ref = affirmChipTargetAfterPlacement(ref, optimisticState, 2, true);

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
    if (second.ok) {
      expect(second.slotNumber).toBe(2);
    }
  });
});
