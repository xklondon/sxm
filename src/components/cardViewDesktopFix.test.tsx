import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GameState } from '../types';
import { createNewBlackjackTable } from '../engine/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import {
  BET_BOX_PULSE,
  BOX_BORDER_NATIVE,
  BOX_BORDER_RUNNING,
  getBoxActivePulseClassName,
  getBoxBorderVisualClasses,
  getBoxCardVisualClasses,
  isCardViewBettingBoxVisuallyAssigned,
  isCardViewBoxNativeForPerson,
  resolveBoxBorderVisualState,
} from './cardViewBox';

const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');

function bettingStateWithTwoBoxes(selectedBoxId: string, freeBoxStake = 0): GameState {
  let state = createNewBlackjackTable();
  const nativeBoxId = 'box-native';
  const freeBoxId = 'box-free';
  const personId = 'person-1';

  state = {
    ...state,
    players: {
      [nativeBoxId]: {
        id: nativeBoxId,
        displayName: 'Box 1',
        controllerName: 'Host',
        role: 'box',
        bankrollOwnerId: personId,
        playerType: 'real',
        startingBalance: 0,
        currentBet: 0,
        cardIds: [],
        status: 'active',
      },
      [freeBoxId]: {
        id: freeBoxId,
        displayName: 'Box 3',
        controllerName: 'Host',
        role: 'box',
        bankrollOwnerId: personId,
        playerType: 'real',
        startingBalance: 0,
        currentBet: 0,
        cardIds: [],
        status: 'active',
      },
      [personId]: {
        id: personId,
        displayName: 'Host',
        controllerName: 'Host',
        role: 'person',
        playerType: 'real',
        startingBalance: 0,
        currentBet: 0,
        cardIds: [],
        status: 'active',
      },
    },
    session: {
      ...state.session,
      playerIds: [personId, nativeBoxId, freeBoxId],
      boxSlotNumbers: { [nativeBoxId]: 1, [freeBoxId]: 3 },
    },
    selectedSeatId: selectedBoxId,
    tableMeta: {
      ...state.tableMeta,
      minimumBet: 5,
      ownerPersonId: personId,
      boxSlots: state.tableMeta.boxSlots.map((s) => {
        if (s.slotNumber === 1) {
          return {
            ...s,
            playerId: nativeBoxId,
            nativeAssignedPersonId: personId,
            bankrollOwnerId: personId,
          };
        }
        if (s.slotNumber === 3) {
          return {
            ...s,
            playerId: freeBoxId,
            nativeAssignedPersonId: null,
            bankrollOwnerId: personId,
          };
        }
        return s;
      }),
    },
  };

  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: personId,
    amount: 5000,
    reason: 'initial-player',
    source: 'setup',
  });

  if (freeBoxStake > 0) {
    state = addChipToBoxStake(state, freeBoxId, freeBoxStake as 5, personId);
  }

  return state;
}

describe('Card View desktop targeted fixes', () => {
  it('adds desktop gap between boxes row and chip tray in both views', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*padding-bottom:\s*calc\(var\(--bj-card-boxes-padding-bottom\) \+ var\(--bj-zone-boxes-tray-gap\)\)/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*height:\s*var\(--bj-zone-tray-height\)/);
  });

  it('aligns hero cards in the hero row without clipping', () => {
    expect(LAYOUT_CSS).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards[\s\S]*overflow:\s*visible/);
    expect(LAYOUT_CSS).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards-slot[\s\S]*overflow:\s*visible/);
    expect(LAYOUT_CSS).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__card-wrap[\s\S]*align-self:\s*center/);
  });

  it('does not mark a free box assigned/active when only selected without stake', () => {
    const state = bettingStateWithTwoBoxes('box-free', 0);
    expect(isCardViewBoxNativeForPerson(state, 'box-native', 'person-1')).toBe(true);
    expect(isCardViewBettingBoxVisuallyAssigned(state, 'box-native', 0, 'person-1')).toBe(true);
    expect(isCardViewBettingBoxVisuallyAssigned(state, 'box-free', 0, 'person-1')).toBe(false);

    const freeResolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: 'box-free',
      viewerPersonId: 'person-1',
      selectedBettingBoxId: 'box-free',
      openStake: 0,
      bettingStage: true,
    });
    expect(getBoxActivePulseClassName(freeResolved)).toBe(BET_BOX_PULSE);
    expect(getBoxBorderVisualClasses(freeResolved)).not.toContain('bj-box--selected');
    expect(getBoxBorderVisualClasses(freeResolved)).not.toContain('bj-box--running');
    expect(getBoxBorderVisualClasses(freeResolved)).not.toContain('bj-box--native-assigned');
  });

  it('marks a free box running only after chips when not selected', () => {
    const stateSelected = bettingStateWithTwoBoxes('box-free', 10);
    const freeSelected = resolveBoxBorderVisualState({
      state: stateSelected,
      boxPlayerId: 'box-free',
      viewerPersonId: 'person-1',
      selectedBettingBoxId: 'box-free',
      openStake: 10,
      bettingStage: true,
    });
    expect(getBoxActivePulseClassName(freeSelected)).toBe(BET_BOX_PULSE);
    expect(getBoxBorderVisualClasses(freeSelected)).toContain(BOX_BORDER_RUNNING);

    const stateNativeSelected = bettingStateWithTwoBoxes('box-native', 10);
    const freeRunning = resolveBoxBorderVisualState({
      state: stateNativeSelected,
      boxPlayerId: 'box-free',
      viewerPersonId: 'person-1',
      selectedBettingBoxId: 'box-native',
      openStake: 10,
      bettingStage: true,
    });
    expect(getBoxBorderVisualClasses(freeRunning)).toContain(BOX_BORDER_RUNNING);
    expect(freeRunning.isSelected).toBe(false);
  });

  it('keeps native box selected styling without stake when it is the chip target', () => {
    const state = bettingStateWithTwoBoxes('box-native', 0);
    const nativeResolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: 'box-native',
      viewerPersonId: 'person-1',
      selectedBettingBoxId: 'box-native',
      openStake: 0,
      bettingStage: true,
    });
    expect(getBoxActivePulseClassName(nativeResolved)).toBe(BET_BOX_PULSE);
    expect(getBoxCardVisualClasses(nativeResolved)).toContain(BOX_BORDER_NATIVE);
    expect(getBoxCardVisualClasses(nativeResolved)).not.toContain('bj-box--selected');
  });
});
