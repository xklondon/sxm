import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../types';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import { tableAfterStartPlaying, boxPlayerId } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session/boxOps';
import {
  BOX_BORDER_CO_BOX,
  BOX_BORDER_NATIVE,
  BOX_BORDER_RUNNING,
  BOX_BORDER_SELECTED,
  getBoxBorderVisualClasses,
  getBoxCardVisualClasses,
  resolveBoxBorderVisualState,
} from './cardViewBox';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');

function personTable(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 3);
  return state;
}

function viewerPersonId(state: GameState): string {
  return state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
}

describe('box border visual states', () => {
  it('native assigned box gets thin yellow class even without stake', () => {
    const state = personTable();
    const nativeBox = boxPlayerId(state, 1)!;
    const personId = viewerPersonId(state);
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: nativeBox,
      viewerPersonId: personId,
      openStake: 0,
      bettingStage: true,
    });
    expect(resolved.isNativeAssigned).toBe(true);
    expect(getBoxBorderVisualClasses(resolved)).toBe(BOX_BORDER_NATIVE);
  });

  it('running free box gets dotted yellow class after stake', () => {
    let state = personTable();
    const freeBox = boxPlayerId(state, 3)!;
    const personId = viewerPersonId(state);
    state = addChipToBoxStake(state, freeBox, 10, personId);
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: freeBox,
      viewerPersonId: personId,
      openStake: 10,
      bettingStage: true,
    });
    expect(resolved.isRunning).toBe(true);
    expect(getBoxBorderVisualClasses(resolved)).toBe(BOX_BORDER_RUNNING);
  });

  it('co-box gets thin orange after stake on someone else controlled box', () => {
    let state = personTable();
    const nativeBox = boxPlayerId(state, 1)!;
    const ownerId = viewerPersonId(state);
    const guestId = 'guest-person';
    state = {
      ...state,
      session: { ...state.session, playerIds: [...state.session.playerIds, guestId] },
      tableMeta: {
        ...state.tableMeta,
        boxStakes: {
          [nativeBox]: {
            amount: 10,
            callerPersonId: ownerId,
            stakerPersonIds: [guestId, ownerId],
            chips: [10],
          },
        },
      },
    };
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: nativeBox,
      viewerPersonId: guestId,
      openStake: 10,
      bettingStage: true,
    });
    expect(resolved.isCoBox).toBe(true);
    expect(getBoxBorderVisualClasses(resolved)).toBe(BOX_BORDER_CO_BOX);
  });

  it('selected box gets thick yellow and only one ownership border class', () => {
    const state = personTable();
    const nativeBox = boxPlayerId(state, 1)!;
    const personId = viewerPersonId(state);
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: nativeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: nativeBox,
      bettingStage: true,
    });
    expect(resolved.isSelected).toBe(true);
    expect(resolved.isNativeAssigned).toBe(false);
    const classes = getBoxBorderVisualClasses(resolved);
    expect(classes).toBe(BOX_BORDER_SELECTED);
    expect(classes).not.toContain(BOX_BORDER_NATIVE);
  });

  it('free box selected without stake does not get running/co/native class', () => {
    const state = personTable();
    const freeBox = boxPlayerId(state, 3)!;
    const personId = viewerPersonId(state);
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: freeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: freeBox,
      openStake: 0,
      bettingStage: true,
    });
    expect(getBoxCardVisualClasses(resolved)).toContain(BOX_BORDER_SELECTED);
    expect(getBoxCardVisualClasses(resolved)).not.toContain(BOX_BORDER_RUNNING);
    expect(getBoxCardVisualClasses(resolved)).not.toContain(BOX_BORDER_NATIVE);
  });

  it('Full Table and Card View share resolveBoxBorderVisualState helper', () => {
    expect(PANEL_SRC).toContain('resolveBoxBorderVisualState');
    expect(CARD_VIEW_SRC).toContain('resolveBoxBorderVisualState');
    expect(PANEL_SRC).toContain('getBoxCardVisualClasses(borderState)');
    expect(CARD_VIEW_SRC).toContain('getBoxCardVisualClasses(borderState)');
  });

  it('shared CSS defines semantic bj-box--* border classes', () => {
    expect(SHARED_CSS).toContain('.bj-phone-view__mini-hand.bj-box--native-assigned');
    expect(SHARED_CSS).toContain('.bj-phone-view__mini-hand.bj-box--running');
    expect(SHARED_CSS).toContain('.bj-phone-view__mini-hand.bj-box--co-box');
    expect(SHARED_CSS).toContain('.bj-phone-view__mini-hand.bj-box--selected');
    expect(SHARED_CSS).toContain('.bj-phone-view__mini-hand.bj-box--turn');
    expect(SHARED_CSS).toContain('.bj-phone-view__mini-hand.bj-box--drop-hover');
  });
});

describe('Full Table desktop vertical stretch', () => {
  it('uses taller shell and bottom tray padding token like Card View stretch', () => {
    expect(SHARED_CSS).toContain('--bj-full-desktop-table-height: min(88vh, 56rem)');
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-desktop-shell[\s\S]*var\(--bj-full-desktop-table-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-casino__felt[\s\S]*var\(--bj-full-desktop-tray-padding-bottom\)/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-view-full-desktop \.bj-table-zone--bottom[\s\S]*flex:\s*0\s*0\s*auto/);
  });

  it('does not change Card View desktop shell height token', () => {
    expect(CARD_LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-desktop-shell[\s\S]*var\(--bj-card-desktop-table-height\)/,
    );
    expect(SHARED_CSS).not.toMatch(/\.bj-view-card-desktop \.bj-table-desktop-shell[\s\S]*--bj-full-desktop-table-height/);
  });
});
