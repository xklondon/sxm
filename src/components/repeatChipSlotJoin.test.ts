import { describe, expect, it } from 'vitest';
import { claimBoxSlot } from '../engine/session/boxOps';
import { addChipToBoxStake, getStakeForBox } from '../engine/blackjack/stakes';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';
import { resolveControllerPersonId } from '../engine/session';
import { filterVisibleBoxSlots } from './tableBoxLayout';
import type { GameState } from '../types';
import {
  affirmChipTargetAfterPlacement,
  createEmptyLocalChipTarget,
  getCurrentChipTargetForBetting,
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
    next = affirmChipTargetAfterPlacement(
      { ...local, hasUserSelected: true },
      gameState,
      local.target.slotNumber,
      online,
    );
  }
  return next;
}

function simulateJoinAndRepeatChips(slotNumber: 2 | 3 | 4, amounts: [number, number]) {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const personId = resolveControllerPersonId(state, 'Alice')!;
  let ref = selectLocalChipTarget(createEmptyLocalChipTarget(), slotNumber);
  let reactState = createEmptyLocalChipTarget();

  for (const amount of amounts) {
    const result = getCurrentChipTargetForBetting({
      ref,
      state: reactState,
      gameState: state,
      online: false,
      viewerPersonId: personId,
      visibleBoxCount: 4,
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) {
      return { state, ref, personId, slotNumber };
    }
    if (!state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber)?.playerId) {
      state = claimBoxSlot(state, slotNumber);
    }
    const boxId = boxPlayerId(state, slotNumber)!;
    state = addChipToBoxStake(state, boxId, amount as 5, personId);
    ref = affirmChipTargetAfterPlacement(ref, state, slotNumber, false);
    ref = simulatePanelReconcile(ref, state, false, true);
    reactState = ref;
  }
  return { state, ref, personId, slotNumber };
}

describe('repeat chip stacking — empty slot join flow', () => {
  it('tap Join Box 2, chip 5 twice → stake 10, no resolution failure', () => {
    const { state, slotNumber } = simulateJoinAndRepeatChips(2, [5, 5]);
    const boxId = boxPlayerId(state, slotNumber)!;
    expect(getStakeForBox(state, boxId)).toBe(10);
  });

  it('tap Join Box 3, chip 5 twice → stake 10', () => {
    const { state, slotNumber } = simulateJoinAndRepeatChips(3, [5, 5]);
    const boxId = boxPlayerId(state, slotNumber)!;
    expect(getStakeForBox(state, boxId)).toBe(10);
  });

  it('tap Join Box 4, chip 5 twice → stake 10', () => {
    const { state, slotNumber } = simulateJoinAndRepeatChips(4, [5, 5]);
    const boxId = boxPlayerId(state, slotNumber)!;
    expect(getStakeForBox(state, boxId)).toBe(10);
  });

  it('visible slot order is descending (box 1 rightmost) without changing tray slot numbers', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const visible = filterVisibleBoxSlots(state.tableMeta.boxSlots, 4);
    expect(visible.map((s) => s.slotNumber)).toEqual([4, 3, 2, 1]);
    expect(visible.find((s) => s.slotNumber === 2)).toBeDefined();
  });

  it('second tap reads ref before react state commits (stale state, fresh ref)', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const personId = resolveControllerPersonId(state, 'Alice')!;
    state = claimBoxSlot(state, 2);
    const box2 = boxPlayerId(state, 2)!;

    const ref = selectLocalChipTarget(createEmptyLocalChipTarget(), 2);
    const staleReact = createEmptyLocalChipTarget();

    state = addChipToBoxStake(state, box2, 5, personId);
    const affirmed = affirmChipTargetAfterPlacement(ref, state, 2, false);

    const second = getCurrentChipTargetForBetting({
      ref: affirmed,
      state: staleReact,
      gameState: state,
      online: false,
      viewerPersonId: personId,
      visibleBoxCount: 4,
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.slotNumber).toBe(2);
    }
    state = addChipToBoxStake(state, box2, 5, personId);
    expect(getStakeForBox(state, box2)).toBe(10);
  });
});
