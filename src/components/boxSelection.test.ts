import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BET_BOX_PULSE,
  BOX_BORDER_NATIVE,
  BOX_BORDER_RUNNING,
  getBoxActivePulseClassName,
  getBetBoxPulseClassName,
  getBoxCardVisualClasses,
  getBoxBorderVisualClasses,
  resolveBoxBorderVisualState,
  isCardViewBettingBoxVisuallyAssigned,
} from './cardViewBox';
import { resolveLocalChipTrayTarget } from './chipTargetSelection';
import { resolveChipTrayBetTarget, type PlaceBetTarget } from '../engine/blackjack/chipPlacement';
import { getStakeForBox } from '../engine/blackjack/stakes';
import { createNewBlackjackTable } from '../engine/session';
import { claimBoxSlot } from '../engine/session/boxOps';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';

describe('box selection — single chip target', () => {
  it('resolveChipTrayBetTarget keeps selected box when set', () => {
    let state = createNewBlackjackTable();
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const nativeBox = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    const box3 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 3)!.playerId!;
    state = { ...state, selectedSeatId: box3 };
    const target = resolveChipTrayBetTarget(state, 'Host', null, false);
    expect(target).toEqual({ kind: 'box', boxId: box3 });
    expect(target?.kind === 'box' ? target.boxId : null).not.toBe(nativeBox);
  });

  it('does not fall through to native box when selectedSeatId is set', () => {
    let state = createNewBlackjackTable();
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const box3 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 3)!.playerId!;
    state = { ...state, selectedSeatId: box3 };
    const target = resolveChipTrayBetTarget(
      state,
      'Host',
      { kind: 'box', boxId: state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId! },
      false,
    );
    expect(target).toEqual({ kind: 'box', boxId: box3 });
  });

  it('uses pulse for selected box and keeps native border underneath', () => {
    const state = createNewBlackjackTable();
    const nativeBox = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.playerId ?? 'box-1';
    const selected = resolveBoxBorderVisualState({
      state: {
        ...state,
        tableMeta: {
          ...state.tableMeta,
          boxSlots: state.tableMeta.boxSlots.map((s) =>
            s.slotNumber === 1 ? { ...s, playerId: nativeBox, nativeAssignedPersonId: 'person-1' } : s,
          ),
        },
      },
      boxPlayerId: nativeBox,
      viewerPersonId: 'person-1',
      selectedBettingBoxId: nativeBox,
      bettingStage: true,
    });
    const nativeOnly = resolveBoxBorderVisualState({
      state: {
        ...state,
        tableMeta: {
          ...state.tableMeta,
          boxSlots: state.tableMeta.boxSlots.map((s) =>
            s.slotNumber === 1 ? { ...s, playerId: nativeBox, nativeAssignedPersonId: 'person-1' } : s,
          ),
        },
      },
      boxPlayerId: nativeBox,
      viewerPersonId: 'person-1',
      bettingStage: true,
    });
    expect(getBoxActivePulseClassName(selected)).toBe(BET_BOX_PULSE);
    expect(getBoxActivePulseClassName(nativeOnly)).toBe('');
    expect(getBetBoxPulseClassName(true, false)).toBe(BET_BOX_PULSE);
    expect(getBetBoxPulseClassName(false, true)).toBe(BET_BOX_PULSE);
  });

  it('pulse applies only to selected box during betting', () => {
    expect(getBetBoxPulseClassName(true, false)).toContain('pulse');
    expect(getBetBoxPulseClassName(false, false)).toBe('');
  });

  it('free box is not visually assigned until stake > 0', () => {
    const base = createNewBlackjackTable();
    const personId = 'person-1';
    const freeBox = 'free-box';
    const state = {
      ...base,
      tableMeta: {
        ...base.tableMeta,
        ownerPersonId: personId,
        boxSlots: base.tableMeta.boxSlots.map((s) =>
          s.slotNumber === 4
            ? { ...s, playerId: freeBox, nativeAssignedPersonId: null }
            : s,
        ),
        boxStakes: {},
      },
    } as typeof base;
    expect(isCardViewBettingBoxVisuallyAssigned(state, freeBox, 0, personId)).toBe(false);
    const staked = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxStakes: {
          [freeBox]: { amount: 10, callerPersonId: personId, chips: [10] },
        },
      },
    };
    expect(isCardViewBettingBoxVisuallyAssigned(staked, freeBox, 10, personId)).toBe(true);
  });

  it('Card View and Full Table share selectedBettingBoxId in BlackjackPanel', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toContain('selectedBettingBoxId');
    expect(src).toContain('selectedBettingBoxId: selectedBettingBoxIdForUi');
    expect(src).toContain('selectedBettingSlotNumber');
    expect(src).not.toContain('selectedBettingBoxId={selectedBettingBoxIdForUi}');
    expect(src).not.toMatch(/effectiveBoxId\s*=\s*gameState\.selectedSeatId\s*\?\?\s*defaultBlackjackSeatId/);
    expect(src).not.toMatch(/function selectBox\(boxId: string\) \{[\s\S]*selectedSeatId: boxId/);
  });

  it('empty occupied box selected without stake gets pulse immediately', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const freeBox = boxPlayerId(state, 3)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: freeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: freeBox,
      openStake: 0,
      bettingStage: true,
    });
    expect(resolved.isSelected).toBe(true);
    expect(getBoxBorderVisualClasses(resolved)).toBe('bj-box--selected');
    expect(getBoxActivePulseClassName(resolved)).toBe(BET_BOX_PULSE);
    expect(getBoxBorderVisualClasses(resolved)).not.toContain(BOX_BORDER_RUNNING);
  });

  it('selected pulse persists after chip placement on the same box', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const freeBox = boxPlayerId(state, 3)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    state = addChipToBoxStake(state, freeBox, 10, personId);
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: freeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: freeBox,
      openStake: 10,
      bettingStage: true,
    });
    expect(getBoxBorderVisualClasses(resolved)).toContain(BOX_BORDER_RUNNING);
    expect(getBoxCardVisualClasses(resolved)).toContain('bj-box--selected');
    expect(getBoxActivePulseClassName(resolved)).toBe(BET_BOX_PULSE);
  });

  it('assigned native box and selected free box can differ visually', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const nativeBox = boxPlayerId(state, 1)!;
    const freeBox = boxPlayerId(state, 3)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const nativeResolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: nativeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: freeBox,
      bettingStage: true,
    });
    const freeResolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: freeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: freeBox,
      bettingStage: true,
    });
    expect(getBoxBorderVisualClasses(nativeResolved)).toBe(BOX_BORDER_NATIVE);
    expect(getBoxActivePulseClassName(nativeResolved)).toBe('');
    expect(getBoxBorderVisualClasses(freeResolved)).toBe('bj-box--selected');
    expect(getBoxActivePulseClassName(freeResolved)).toBe(BET_BOX_PULSE);
  });

  it('assigned and selected on same native box renders ownership plus pulse', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const nativeBox = boxPlayerId(state, 1)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: nativeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: nativeBox,
      bettingStage: true,
    });
    expect(getBoxCardVisualClasses(resolved)).toContain(BOX_BORDER_NATIVE);
    expect(getBoxCardVisualClasses(resolved)).toContain('bj-box--selected');
    expect(getBoxActivePulseClassName(resolved)).toBe(BET_BOX_PULSE);
  });

  it('chip tray uses selectedBettingBoxId local target, not assigned native box', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const nativeBox = boxPlayerId(state, 1)!;
    const freeBox = boxPlayerId(state, 3)!;
    const trayState = { ...state, selectedSeatId: freeBox };
    const target = resolveChipTrayBetTarget(trayState, 'Host', null, false);
    expect(target).toEqual({ kind: 'box', boxId: freeBox });
    expect(target?.kind === 'box' ? target.boxId : null).not.toBe(nativeBox);
  });

  it('does not sync selectedBettingBoxId from gameState.selectedSeatId offline', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).not.toMatch(
      /if\s*\(\s*!onlineDispatch\s*\)\s*\{[\s\S]*setSelectedBettingBoxId\(gameState\.selectedSeatId\)/,
    );
    expect(src).not.toMatch(/setSelectedBettingBoxId/);
    expect(src).toContain('localChipSelection');
    expect(src).toMatch(/uiFromLocalChipTarget\(localChipSelection\.target\)/);
  });

  it('does not overwrite local selection during chip placement', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toMatch(/function placeBetAtTarget\(target: PlaceBetTarget[\s\S]*?const payload = placeBetPayloadFromTarget/);
    expect(src).toContain('preserveLocalChipTargetAfterStateSync(nextState, target)');
    expect(src).toContain('selectLocalTarget(placementTarget)');
    expect(src).toContain('selectLocalTarget(target)');
  });

  it('selectBox sets canonical local chip target for occupied boxes', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toMatch(/function selectBox\(boxId: string\) \{[\s\S]*selectLocalTarget/);
  });

  it('pulse matches selected slot number on occupied box row', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: box3,
      viewerPersonId: null,
      selectedBettingBoxId: null,
      selectedBettingSlotNumber: 3,
      bettingStage: true,
    });
    expect(resolved.isSelected).toBe(true);
    expect(getBoxActivePulseClassName(resolved)).toBe(BET_BOX_PULSE);
  });

  it('reconcile effect upgrades slot targets instead of clearing after materialization', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toContain('reconcileLocalChipTarget');
    expect(src).toContain('commitLocalChipTarget');
  });

  it('assigned native box and explicit selected box 5 can differ', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 5);
    const nativeBox = boxPlayerId(state, 1)!;
    const box5 = boxPlayerId(state, 5)!;
    const nativeResolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: nativeBox,
      viewerPersonId: state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId,
      selectedBettingBoxId: box5,
      bettingStage: true,
    });
    const selectedResolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: box5,
      viewerPersonId: state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId,
      selectedBettingBoxId: box5,
      bettingStage: true,
    });
    expect(nativeResolved.isNativeAssigned).toBe(true);
    expect(nativeResolved.isSelected).toBe(false);
    expect(selectedResolved.isSelected).toBe(true);
    expect(getBoxActivePulseClassName(nativeResolved)).toBe('');
    expect(getBoxActivePulseClassName(selectedResolved)).toBe(BET_BOX_PULSE);
  });

  it('handleChipTrayClick reads resolveActiveChipTrayTarget at click time', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toMatch(
      /function handleChipTrayClick\(value: ChipValue\) \{[\s\S]*resolveActiveChipTrayTarget\(\)/,
    );
    expect(src).not.toMatch(
      /function handleChipTrayClick\(value: ChipValue\) \{[\s\S]*selectedSeatId:/,
    );
    expect(src).toContain('resolveTrayTargetFromLocalSelection');
    expect(src).toContain('localSelectedChipTargetRef');
    expect(src).not.toContain('resolveChipTrayBetTarget');
  });

  it('double chip placement on explicit Box 5 target keeps tray on Box 5', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 5);
    const nativeBox = boxPlayerId(state, 1)!;
    const box5 = boxPlayerId(state, 5)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const explicit: PlaceBetTarget = { kind: 'box', boxId: box5 };
    const first = addChipToBoxStake(state, box5, 10, personId);
    const second = addChipToBoxStake(first, box5, 10, personId);
    expect(getStakeForBox(second, box5)).toBe(20);
    expect(getStakeForBox(second, nativeBox)).toBe(0);
    const trayTarget = resolveLocalChipTrayTarget(second, {
      userPicked: true,
      explicit,
      online: false,
    });
    expect(trayTarget).toEqual({ kind: 'box', boxId: box5 });
  });

  it('selects viewer assigned box by default when no explicit pick exists', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toContain('applyDefaultAssignedChipTarget');
    expect(src).toContain('localSelectedChipTargetRef');
    expect(src).toMatch(/if \(local\.hasUserSelected\) \{\s*return;\s*\}/);
  });

  it('does not auto-reselect assigned box after user picks another target', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toContain('localSelectedChipTargetRef');
    expect(src).toContain('selectLocalChipTarget');
    expect(src).toContain('resolveTrayTargetFromLocalSelection');
    expect(src).not.toMatch(/if \(!bettingOpen\) \{\s*setSelectedBettingBoxId\(playerId\)/);
  });

  it('chip tray target uses canonical local selection only', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toMatch(/function resolveActiveChipTrayTarget\(\)[\s\S]*resolveTrayTargetFromLocalSelection/);
    expect(src).not.toContain('resolveChipTrayBetTarget');
    expect(src).not.toMatch(/function resolveActiveChipTrayTarget\(\) \{[\s\S]*selectedSeatId/);
  });
});
