import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { addChipToBoxStake, getStakeForBox, type StakeChipValue } from '../engine/blackjack/stakes';
import { claimBoxSlot } from '../engine/session/boxOps';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';
import {
  affirmChipTargetAfterPlacement,
  createEmptyLocalChipTarget,
  reconcileLocalChipTarget,
  resolveCurrentChipTarget,
  selectLocalChipTarget,
  uiFromLocalChipTarget,
} from './localChipTargetSelection';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

function simulateTwoTrayBets(slotNumber: 1 | 2 | 3, amounts: [StakeChipValue, StakeChipValue]) {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, slotNumber);
  const targetBox = boxPlayerId(state, slotNumber)!;
  const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';

  let local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: targetBox });

  for (const amount of amounts) {
    const resolved = resolveCurrentChipTarget({
      local,
      state,
      online: false,
      viewerPersonId: personId,
      visibleBoxCount: 7,
    });
    expect(resolved).toEqual({ kind: 'box', boxId: targetBox });
    state = addChipToBoxStake(state, targetBox, amount, personId);
    local = affirmChipTargetAfterPlacement(local, state, resolved!, false);
    local = reconcileLocalChipTarget(local, state, false);
    expect(uiFromLocalChipTarget(local.target).selectedBettingBoxId).toBe(targetBox);
    expect(resolveCurrentChipTarget({
      local,
      state,
      online: false,
      viewerPersonId: personId,
    })).toEqual({ kind: 'box', boxId: targetBox });
  }

  return { state, targetBox, personId };
}

describe('repeat chip stacking — canonical target resolution', () => {
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
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: targetBox });
    for (const amount of [5, 5] as const) {
      const resolved = resolveCurrentChipTarget({
        local,
        state,
        online: false,
        viewerPersonId: personId,
      });
      expect(resolved).toEqual({ kind: 'box', boxId: targetBox });
      state = addChipToBoxStake(state, targetBox, amount, personId);
      local = affirmChipTargetAfterPlacement(local, state, resolved!, false);
      local = reconcileLocalChipTarget(local, state, false);
    }
    expect(getStakeForBox(state, targetBox)).toBe(10);
  });

  it('affirmChipTargetAfterPlacement sets hasUserSelected after first chip from default target', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const nativeBox = boxPlayerId(state, 1)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    let local = createEmptyLocalChipTarget();
    local = { ...local, target: { kind: 'box', boxId: nativeBox }, hasUserSelected: false };

    state = addChipToBoxStake(state, nativeBox, 5, personId);
    local = affirmChipTargetAfterPlacement(local, state, { kind: 'box', boxId: nativeBox }, false);
    expect(local.hasUserSelected).toBe(true);
    expect(uiFromLocalChipTarget(local.target).selectedBettingBoxId).toBe(nativeBox);

    state = addChipToBoxStake(state, nativeBox, 5, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(resolveCurrentChipTarget({
      local,
      state,
      online: false,
      viewerPersonId: personId,
    })).toEqual({ kind: 'box', boxId: nativeBox });
  });

  it('online-style transient sync keeps user-selected target when slot row still exists', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: box3 });
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
    expect(local.target).toEqual({ kind: 'slot', slotNumber: 3 });
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

  it('BlackjackPanel uses resolveCurrentChipTarget for tray and affirm after placement', () => {
    expect(PANEL_SRC).toContain('resolveCurrentChipTarget');
    expect(PANEL_SRC).toContain('affirmChipTargetAfterPlacement');
    expect(PANEL_SRC).toMatch(
      /function handleChipTrayClick\(value: ChipValue\) \{[\s\S]*resolveActiveChipTrayTarget\(\)/,
    );
    expect(PANEL_SRC).toContain('preserveLocalChipTargetAfterStateSync(nextState, target)');
    expect(PANEL_SRC).toContain('selectLocalTarget(placementTarget)');
    expect(PANEL_SRC).not.toContain('resolveChipTrayBetTarget');
  });
});
