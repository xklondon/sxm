import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mergeStakeChipsForSlotDisplay,
  resolveOccupantBoxIdForSlot,
  resolvePlaceBetPayloadTarget,
  slotArcReactKey,
} from './blackjackBoxPlacementContract';
import {
  affirmChipTargetAfterPlacement,
  createEmptyLocalChipTarget,
  getCurrentChipTargetForBetting,
  reconcileLocalChipTarget,
  resolveTraySlotFromLocalSelection,
  selectLocalChipTarget,
  uiFromLocalChipTarget,
} from './localChipTargetSelection';
import { addChipToBoxStake, getStakeForBox } from '../engine/blackjack/stakes';
import { claimBoxSlot } from '../engine/session/boxOps';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';
import { placeBetPayloadFromTarget } from '../engine/blackjack/chipPlacement';
import { resolveEffectiveVisibleBoxCount, DEFAULT_VISIBLE_TABLE_BOXES } from './tableBoxLayout';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');

describe('blackjackBoxPlacementContract', () => {
  it('uses slotNumber-only React keys in arc row', () => {
    expect(PANEL_SRC).toContain('function renderArcSlot(slotNumber: number)');
    expect(PANEL_SRC).toContain('slotArcReactKey(slotNumber)');
    expect(PANEL_SRC).not.toMatch(/key=\{`box-\$\{boxId\}`\}/);
    expect(PANEL_SRC).not.toMatch(/key=\{`empty-\$\{slotNumber\}`\}/);
    expect(slotArcReactKey(3)).toBe('slot-3');
  });

  it('does not claim boxes optimistically online for empty slots', () => {
    expect(PANEL_SRC).toMatch(
      /applyOptimisticChipPlacement[\s\S]*if \(online\)[\s\S]*return state/,
    );
    expect(PANEL_SRC).toContain('addPendingOnlineStake(slotNumber, amount)');
    expect(PANEL_SRC).not.toMatch(/onlineDispatch[\s\S]{0,400}applyOptimisticChipPlacement[\s\S]{0,200}claimBoxSlot/);
  });

  it('derives placeBet payload from slotNumber at send time', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    expect(resolvePlaceBetPayloadTarget(state, 3, true, false)).toEqual({
      kind: 'box',
      boxId: box3,
    });
    expect(resolvePlaceBetPayloadTarget(state, 4, true, false)).toEqual({
      kind: 'slot',
      slotNumber: 4,
    });
    expect(resolvePlaceBetPayloadTarget(state, 3, true, true)).toEqual({
      kind: 'slot',
      slotNumber: 3,
    });
  });

  it('keeps slot anchor after server boxId rotation', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const oldBox = boxPlayerId(state, 3)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);
    const newBox = 'server-box-3';
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
    local = reconcileLocalChipTarget(local, rotated, true);
    expect(local.target).toEqual({ slotNumber: 3 });
    expect(uiFromLocalChipTarget(local.target, rotated).selectedBettingBoxId).toBe(newBox);
    expect(placeBetPayloadFromTarget(resolvePlaceBetPayloadTarget(rotated, 3, true, false), 5)).toEqual({
      boxId: newBox,
      amount: 5,
    });
  });

  it('rapid tray taps on boxes 2–4 stay on the same slot', () => {
    for (const slotNumber of [2, 3, 4] as const) {
      let state = tableAfterStartPlaying(500);
      state = claimBoxSlot(state, slotNumber);
      const boxId = boxPlayerId(state, slotNumber)!;
      const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
      let local = selectLocalChipTarget(createEmptyLocalChipTarget(), slotNumber);
      state = addChipToBoxStake(state, boxId, 10, personId);
      local = affirmChipTargetAfterPlacement(local, state, slotNumber, true);
      state = addChipToBoxStake(state, boxId, 5, personId);
      local = reconcileLocalChipTarget(local, state, true);
      expect(resolveTraySlotFromLocalSelection(local, state, personId)).toBe(slotNumber);
      expect(getStakeForBox(state, boxId)).toBe(15);
    }
  });

  it('does not auto-expand visible row when slot 5 is first occupied', () => {
    const slots = [
      { slotNumber: 1, playerId: 'p1' },
      { slotNumber: 2, playerId: null },
      { slotNumber: 3, playerId: null },
      { slotNumber: 4, playerId: null },
      { slotNumber: 5, playerId: 'p5' },
    ] as const;
    expect(resolveEffectiveVisibleBoxCount(slots as never, DEFAULT_VISIBLE_TABLE_BOXES)).toBe(4);
  });

  it('shows pending online chips in empty slot preview without boxId', () => {
    let state = tableAfterStartPlaying(500);
    const pending = [5, 10] as const;
    expect(resolveOccupantBoxIdForSlot(state, 2)).toBeNull();
    expect(mergeStakeChipsForSlotDisplay(state, 2, null, pending)).toEqual([5, 10]);
  });

  it('local chip tray never uses selectedSeatId', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    state = { ...state, selectedSeatId: boxPlayerId(state, 1)! };
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);
    const resolved = getCurrentChipTargetForBetting({
      ref: local,
      state: local,
      gameState: state,
      online: true,
      viewerPersonId: null,
    });
    expect(resolved.ok && resolved.ok ? resolved.slotNumber : null).toBe(3);
  });

  it('locks stake slot layout for chip pile overflow', () => {
    expect(LAYOUT_CSS).toMatch(/\.bj-phone-view__mini-stake-slot \.stake-chips[\s\S]*position:\s*absolute/);
    expect(LAYOUT_CSS).toMatch(/\.stake-chips__remove[\s\S]*position:\s*absolute/);
    expect(LAYOUT_CSS).toMatch(/overflow:\s*hidden/);
  });

  it('shows stake amount on unclaimed staked empty slots', () => {
    expect(PANEL_SRC).toContain('hasOpenStake');
    expect(PANEL_SRC).toContain('bj-arc__slot--has-stake');
    expect(PANEL_SRC).toContain('isUnclaimedStakedSlot');
    expect(LAYOUT_CSS).toMatch(/bj-arc__slot--has-stake[\s\S]*bj-phone-view__box-value--above/);
    expect(SHARED_CSS).toMatch(/bj-arc__slot--has-stake[\s\S]*bj-phone-view__box-value--above/);
  });
});

describe('box placement — assigned default uses slot not box fallback', () => {
  it('seeds assigned slot 1 before user selection', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const local = createEmptyLocalChipTarget();
    const resolved = resolveTraySlotFromLocalSelection(local, state, personId);
    expect(resolved).toBe(1);
  });
});
