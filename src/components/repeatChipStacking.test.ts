import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { addChipToBoxStake, getStakeForBox, type StakeChipValue } from '../engine/blackjack/stakes';
import { claimBoxSlot } from '../engine/session/boxOps';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';
import {
  affirmChipTargetAfterPlacement,
  createEmptyLocalChipTarget,
  getCurrentChipTargetForBetting,
  reconcileLocalChipTarget,
  resolveCurrentChipTarget,
  selectLocalChipTarget,
  uiFromLocalChipTarget,
} from './localChipTargetSelection';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

function simulateTwoTrayBets(slotNumber: 1 | 2 | 3 | 4, amounts: [StakeChipValue, StakeChipValue]) {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, slotNumber);
  const targetBox = boxPlayerId(state, slotNumber)!;
  const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';

  let local = selectLocalChipTarget(createEmptyLocalChipTarget(), slotNumber);
  const visibleBoxCount = 4;

  for (const amount of amounts) {
    const resolved = resolveCurrentChipTarget({
      local,
      state,
      online: false,
      viewerPersonId: personId,
      visibleBoxCount,
    });
    expect(resolved).toEqual({ kind: 'box', boxId: targetBox });
    state = addChipToBoxStake(state, targetBox, amount, personId);
    local = affirmChipTargetAfterPlacement(local, state, slotNumber, false);
    local = reconcileLocalChipTarget(local, state, false);
    expect(uiFromLocalChipTarget(local.target, state).selectedBettingBoxId).toBe(targetBox);
    expect(
      resolveCurrentChipTarget({
        local,
        state,
        online: false,
        viewerPersonId: personId,
        visibleBoxCount,
      }),
    ).toEqual({ kind: 'box', boxId: targetBox });
  }

  return { state, targetBox, personId };
}

describe('repeat chip stacking — canonical target resolution', () => {
  it('select box 4, tap 5 twice → both bets on box 4, no null target', () => {
    const { state, targetBox } = simulateTwoTrayBets(4, [5, 5]);
    expect(getStakeForBox(state, targetBox)).toBe(10);
  });

  it('switching selected box changes tray target', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 2);
    state = claimBoxSlot(state, 3);
    const box2 = boxPlayerId(state, 2)!;
    const box3 = boxPlayerId(state, 3)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const visibleBoxCount = 4;

    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 2);
    state = addChipToBoxStake(state, box2, 5, personId);
    local = affirmChipTargetAfterPlacement(local, state, 2, false);

    local = selectLocalChipTarget(local, 3);
    expect(
      resolveCurrentChipTarget({
        local,
        state,
        online: false,
        viewerPersonId: personId,
        visibleBoxCount,
      }),
    ).toEqual({ kind: 'box', boxId: box3 });

    state = addChipToBoxStake(state, box3, 5, personId);
    expect(getStakeForBox(state, box2)).toBe(5);
    expect(getStakeForBox(state, box3)).toBe(5);
  });

  it('select box 2, tap 5 twice → both bets on box 2, no null target', () => {
    const { state, targetBox } = simulateTwoTrayBets(2, [5, 5]);
    expect(getStakeForBox(state, targetBox)).toBe(10);
  });

  it('select free box 3, tap 10 twice → both bets on box 3', () => {
    const { state, targetBox } = simulateTwoTrayBets(3, [10, 10]);
    expect(getStakeForBox(state, targetBox)).toBe(20);
  });

  it('select native box 1, tap 5 twice → both bets on native box', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const targetBox = boxPlayerId(state, 1)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 1);
    const visibleBoxCount = 4;
    for (const amount of [5, 5] as const) {
      const resolved = resolveCurrentChipTarget({
        local,
        state,
        online: false,
        viewerPersonId: personId,
        visibleBoxCount,
      });
      expect(resolved).toEqual({ kind: 'box', boxId: targetBox });
      state = addChipToBoxStake(state, targetBox, amount, personId);
      local = affirmChipTargetAfterPlacement(local, state, 1, false);
      local = reconcileLocalChipTarget(local, state, false);
    }
    expect(getStakeForBox(state, targetBox)).toBe(10);
  });

  it('online snapshot after first chip keeps selectedBettingBoxId (production visibleBoxCount path)', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);

    const first = resolveCurrentChipTarget({
      local,
      state,
      online: true,
      viewerPersonId: personId,
      visibleBoxCount: 4,
    });
    expect(first).toEqual({ kind: 'box', boxId: box3 });
    state = addChipToBoxStake(state, box3, 10, personId);
    local = affirmChipTargetAfterPlacement(local, state, 3, true);
    local = reconcileLocalChipTarget(local, state, true);

    expect(uiFromLocalChipTarget(local.target, state).selectedBettingBoxId).toBe(box3);
    expect(
      resolveCurrentChipTarget({
        local,
        state,
        online: true,
        viewerPersonId: personId,
        visibleBoxCount: 4,
      }),
    ).toEqual({ kind: 'box', boxId: box3 });
  });

  it('drag/drop to box 3 then tray tap keeps box 3 target', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';

    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);
    state = addChipToBoxStake(state, box3, 10, personId);
    local = affirmChipTargetAfterPlacement(local, state, 3, false);
    local = reconcileLocalChipTarget(local, state, false);

    expect(
      resolveCurrentChipTarget({
        local,
        state,
        online: false,
        viewerPersonId: personId,
        visibleBoxCount: 4,
      }),
    ).toEqual({ kind: 'box', boxId: box3 });

    state = addChipToBoxStake(state, box3, 5, personId);
    local = affirmChipTargetAfterPlacement(local, state, 3, false);
    expect(getStakeForBox(state, box3)).toBe(15);
  });

  it('Full Table and Card View share the same chip tray target route in BlackjackPanel', () => {
    expect(PANEL_SRC).toContain('renderPlayerBoxesArc');
    expect(PANEL_SRC).toContain('renderTrayInner');
    expect(PANEL_SRC).toContain('onChipClick={handleChipTrayClick}');
    expect(PANEL_SRC).not.toMatch(/viewMode === 'card'[\s\S]{0,400}resolveChipTrayBetTarget/);
    expect(PANEL_SRC).not.toMatch(/viewMode === 'full'[\s\S]{0,400}resolveChipTrayBetTarget/);
  });

  it('affirmChipTargetAfterPlacement sets hasUserSelected after first chip from default target', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const nativeBox = boxPlayerId(state, 1)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    let local = createEmptyLocalChipTarget();
    local = { ...local, target: { slotNumber: 1 }, hasUserSelected: false };

    state = addChipToBoxStake(state, nativeBox, 5, personId);
    local = affirmChipTargetAfterPlacement(local, state, 1, false);
    expect(local.hasUserSelected).toBe(true);
    expect(uiFromLocalChipTarget(local.target, state).selectedBettingBoxId).toBe(nativeBox);

    state = addChipToBoxStake(state, nativeBox, 5, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(
      resolveCurrentChipTarget({
        local,
        state,
        online: false,
        viewerPersonId: personId,
      }),
    ).toEqual({ kind: 'box', boxId: nativeBox });
  });

  it('online-style transient sync keeps user-selected slot when row still exists', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);
    const transient = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((slot) =>
          slot.playerId === box3 ? { ...slot, playerId: null } : slot,
        ),
      },
    } as typeof state;
    local = reconcileLocalChipTarget(local, transient, true);
    expect(local.hasUserSelected).toBe(true);
    expect(local.target).toEqual({ slotNumber: 3 });
    expect(
      resolveCurrentChipTarget({
        local,
        state: transient,
        online: true,
        viewerPersonId: null,
        visibleBoxCount: 4,
      }),
    ).toEqual({ kind: 'slot', slotNumber: 3 });
  });

  it('resolveCurrentChipTarget returns null only when there is no local target', () => {
    const state = tableAfterStartPlaying(500);
    expect(
      resolveCurrentChipTarget({
        local: createEmptyLocalChipTarget(),
        state,
        online: false,
        viewerPersonId: null,
      }),
    ).toBeNull();
  });

  it('user-selected target survives visibleBoxCount filter after first chip (production path)', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 2);
    const box2 = boxPlayerId(state, 2)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 2);

    state = addChipToBoxStake(state, box2, 5, personId);
    local = affirmChipTargetAfterPlacement(local, state, 2, false);
    local = reconcileLocalChipTarget(local, state, false);

    expect(
      resolveCurrentChipTarget({
        local,
        state,
        online: false,
        viewerPersonId: personId,
        visibleBoxCount: 4,
      }),
    ).toEqual({ kind: 'box', boxId: box2 });
  });

  it('BlackjackPanel logs chip target null reason in dev/test', () => {
    expect(PANEL_SRC).toContain('logChipTargetResolution');
  });

  it('immediate second tray tap reads ref before React state commits', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 2);
    const box2 = boxPlayerId(state, 2)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const refTarget = selectLocalChipTarget(createEmptyLocalChipTarget(), 2);
    const staleState = createEmptyLocalChipTarget();

    for (const amount of [5, 5] as const) {
      const result = getCurrentChipTargetForBetting({
        ref: refTarget,
        state: staleState,
        gameState: state,
        online: false,
        viewerPersonId: personId,
        visibleBoxCount: 4,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.source).toBe('ref');
      expect(result.slotNumber).toBe(2);
      state = addChipToBoxStake(state, box2, amount, personId);
    }
    expect(getStakeForBox(state, box2)).toBe(10);
  });

  it('Tap a box to bet path only when ref and state have no target', () => {
    const state = tableAfterStartPlaying(500);
    const empty = getCurrentChipTargetForBetting({
      ref: createEmptyLocalChipTarget(),
      state: createEmptyLocalChipTarget(),
      gameState: state,
      online: false,
      viewerPersonId: null,
      visibleBoxCount: 4,
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.reason).toBe('no-local-target');

    const withRef = getCurrentChipTargetForBetting({
      ref: selectLocalChipTarget(createEmptyLocalChipTarget(), 2),
      state: createEmptyLocalChipTarget(),
      gameState: claimBoxSlot(state, 2),
      online: false,
      viewerPersonId: null,
      visibleBoxCount: 4,
    });
    expect(withRef.ok).toBe(true);
  });

  it('BlackjackPanel uses getCurrentChipTargetForBetting for tray and affirm after placement', () => {
    expect(PANEL_SRC).toContain('getCurrentChipTargetForBetting');
    expect(PANEL_SRC).toContain('affirmChipTargetAfterPlacement');
    expect(PANEL_SRC).toMatch(
      /function handleChipTrayClick\(value: ChipValue\) \{[\s\S]*resolveActiveChipTrayTarget\(\)/,
    );
    expect(PANEL_SRC).toContain('preserveLocalChipTargetAfterStateSync(undefined, slotNumber)');
    expect(PANEL_SRC).toContain('selectLocalTarget(slotNumber)');
    expect(PANEL_SRC).not.toContain('resolveChipTrayBetTarget');
    expect(PANEL_SRC).not.toMatch(/localSelectedChipTargetRef\.current = localChipSelection/);
  });
});
