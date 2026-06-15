import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import {
  BET_BOX_PULSE,
  BOX_BORDER_NATIVE,
  BOX_BORDER_RUNNING,
  getBoxActivePulseClassName,
  getBoxBorderVisualClasses,
  getBoxCardVisualClasses,
  resolveBoxBorderVisualState,
} from './cardViewBox';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { addChipToBoxStake, blackjackHandKey } from '../engine/blackjack';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');

function viewerPersonId(state: GameState): string {
  return state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
}

describe('box selection + turn pulse', () => {
  it('selectedBettingBoxId always receives active pulse during betting', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
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
    expect(getBoxActivePulseClassName(resolved)).toBe(BET_BOX_PULSE);
  });

  it('selected native box keeps ownership border underneath pulse', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const nativeBox = boxPlayerId(state, 1)!;
    const personId = viewerPersonId(state);
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: nativeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: nativeBox,
      bettingStage: true,
    });
    expect(resolved.isNativeAssigned).toBe(true);
    expect(getBoxBorderVisualClasses(resolved)).toContain(BOX_BORDER_NATIVE);
    expect(getBoxBorderVisualClasses(resolved)).toContain('bj-box--selected');
    expect(getBoxActivePulseClassName(resolved)).toBe(BET_BOX_PULSE);
    expect(getBoxCardVisualClasses(resolved)).toContain(BOX_BORDER_NATIVE);
    expect(getBoxCardVisualClasses(resolved)).toContain('bj-box--selected');
  });

  it('selected running box keeps dotted ownership border underneath pulse', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const freeBox = boxPlayerId(state, 3)!;
    const personId = viewerPersonId(state);
    state = addChipToBoxStake(state, freeBox, 10, personId);
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: freeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: freeBox,
      bettingStage: true,
      openStake: 10,
    });
    expect(getBoxBorderVisualClasses(resolved)).toContain(BOX_BORDER_RUNNING);
    expect(getBoxBorderVisualClasses(resolved)).toContain('bj-box--selected');
    expect(getBoxActivePulseClassName(resolved)).toBe(BET_BOX_PULSE);
  });

  it('active player turn box receives the same pulse during play', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 2);
    const box2 = boxPlayerId(state, 2)!;
    const k2 = blackjackHandKey(box2, 0);
    state = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        status: 'player-turns',
        activeHandKey: k2,
        activePlayerId: box2,
        dealerCardIds: [findCardId(state.deck!, '7'), findCardId(state.deck!, 'K')],
        dealerHoleHidden: true,
        playerHands: {
          [k2]: {
            ...createBlackjackPlayerHand(box2, 0),
            cardIds: [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')],
            currentBet: 10,
            actionStatus: 'acting',
          },
        },
      },
    };
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: box2,
      viewerPersonId: viewerPersonId(state),
      activeBoxId: box2,
      playerPhase: true,
    });
    expect(resolved.isTurn).toBe(true);
    expect(getBoxBorderVisualClasses(resolved)).not.toContain('bj-box--turn');
    expect(PANEL_SRC).toContain("borderState.isTurn && viewMode === 'full' ? BOX_BORDER_TURN : ''");
    expect(getBoxActivePulseClassName(resolved)).toBe('');
  });

  it('Full Table and Panel player boxes use getBoxActivePulseClassName on borderState', () => {
    expect(PANEL_SRC).toContain('getBoxActivePulseClassName(borderState)');
    expect(PANEL_SRC).toContain('renderPlayerBoxesArc');
    expect(CARD_VIEW_SRC).not.toContain('getBoxActivePulseClassName');
    expect(PANEL_SRC).not.toMatch(/getBetBoxPulseClassName\(bettingOpen/);
    expect(CARD_VIEW_SRC).not.toMatch(/getBetBoxPulseClassName\(bettingOpen/);
  });

  it('selectBox does not persist selectedSeatId to multiplayer state', () => {
    expect(PANEL_SRC).not.toMatch(/function selectBox\(boxId: string\) \{[\s\S]*selectedSeatId: boxId/);
  });
});
