import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackCardView } from './BlackjackCardView';
import { createNewBlackjackTable } from '../engine/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import {
  isCardViewBettingBoxVisuallyAssigned,
  isCardViewBoxNativeForPerson,
} from './cardViewBox';

const noop = () => {};
const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');

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

function renderBettingCardView(state: GameState): string {
  return renderToStaticMarkup(
    <BlackjackCardView
      dealer={<div className="dealer-block" />}
      tray={<div className="bj-casino__tray-wrap" />}
      gameState={state}
      focusBoxId={state.selectedSeatId ?? undefined}
      selectedBettingBoxId={state.selectedSeatId}
      activeBoxId={null}
      showHoleHidden={false}
      protocolPhase="betting"
      bettingOpen
      gameEnded={false}
      deviceView="desktop"
      viewerPersonId="person-1"
      onSelectBox={noop}
      onClaimSlot={noop}
      onReleaseSlot={noop}
      onAddChip={noop}
      onClearStake={noop}
      onRemoveLastChip={noop}
      onSlotChipDrop={noop}
      onStay={noop}
      onCard={noop}
      onDouble={noop}
      onSplit={noop}
      onBack={noop}
    />,
  );
}

describe('Card View desktop targeted fixes', () => {
  it('adds desktop-only gap between boxes row and chip tray', () => {
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-card-layout__boxes[\s\S]*padding-bottom:\s*calc\(var\(--bj-card-boxes-padding-bottom\) \+ 0\.45rem\)/,
    );
    expect(LAYOUT_CSS).toMatch(/\.bj-view-card-desktop \.bj-card-layout__tray[\s\S]*padding-top:\s*0\.1rem/);
  });

  it('aligns hero cards to the top so rank/suit stay visible when clipped', () => {
    expect(LAYOUT_CSS).toMatch(/\.bj-card-layout__hero \.bj-phone-view__cards[\s\S]*align-items:\s*flex-start/);
    expect(LAYOUT_CSS).toMatch(/\.bj-card-layout__hero \.bj-phone-view__cards-slot[\s\S]*align-items:\s*flex-start/);
    expect(LAYOUT_CSS).toMatch(/\.bj-card-layout__hero \.bj-phone-view__card-wrap[\s\S]*align-self:\s*flex-start/);
  });

  it('does not mark a free box assigned/active when only selected without stake', () => {
    const state = bettingStateWithTwoBoxes('box-free', 0);
    expect(isCardViewBoxNativeForPerson(state, 'box-native', 'person-1')).toBe(true);
    expect(isCardViewBettingBoxVisuallyAssigned(state, 'box-native', 0, 'person-1')).toBe(true);
    expect(isCardViewBettingBoxVisuallyAssigned(state, 'box-free', 0, 'person-1')).toBe(false);

    const html = renderBettingCardView(state);
    const freeShell =
      html.match(/data-chip-drop-box="box-free"[\s\S]*?(?=data-chip-drop-slot="2")/)?.[0] ?? '';
    expect(freeShell).toContain('bj-phone-view__mini-hand--selected');
    expect(freeShell).not.toContain('bj-phone-view__mini-hand--assigned');
  });

  it('marks a free box assigned only after chips are placed', () => {
    const state = bettingStateWithTwoBoxes('box-free', 10);
    expect(isCardViewBettingBoxVisuallyAssigned(state, 'box-free', 10, 'person-1')).toBe(true);

    const html = renderBettingCardView(state);
    expect(html).toContain('Bet: 10');
    expect(html).toContain('bj-phone-view__mini-hand--assigned');
    expect(html).toMatch(/aria-label="Box 3[^"]*"[^>]*aria-current="true"/);
  });

  it('keeps native box selected styling without stake when it is the chip target', () => {
    const state = bettingStateWithTwoBoxes('box-native', 0);
    const html = renderBettingCardView(state);
    expect(html).toMatch(/data-chip-drop-box="box-native"[\s\S]*bj-phone-view__mini-hand--selected/);
    expect(html).not.toMatch(/data-chip-drop-box="box-native"[\s\S]*bj-phone-view__mini-hand--assigned/);
    expect(html).toContain('Host');
  });
});
