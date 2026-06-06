import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackCardView } from './BlackjackCardView';
import { TABLE_UX } from './tableUxContract';
import { createNewBlackjackTable } from '../engine/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { addChipToBoxStake } from '../engine/blackjack/stakes';

const noop = () => {};

function bettingState(stakeChips: number[]): GameState {
  let state = createNewBlackjackTable();
  const boxId = 'box-test';
  const personId = 'person-1';
  state = {
    ...state,
    players: {
      [boxId]: {
        id: boxId,
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
      playerIds: [personId, boxId],
      boxSlotNumbers: { [boxId]: 1 },
    },
    selectedSeatId: boxId,
    tableMeta: {
      ...state.tableMeta,
      minimumBet: 5,
      ownerPersonId: personId,
      boxSlots: state.tableMeta.boxSlots.map((s) =>
        s.slotNumber === 1
          ? { ...s, playerId: boxId, nativeAssignedPersonId: personId, bankrollOwnerId: personId }
          : s,
      ),
    },
  };
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: personId,
    amount: 5000,
    reason: 'initial-player',
    source: 'setup',
  });
  for (const chip of stakeChips) {
    state = addChipToBoxStake(state, boxId, chip as 1 | 2 | 5 | 10 | 50, personId);
  }
  return state;
}

function render(state: GameState): string {
  return renderToStaticMarkup(
    <BlackjackCardView
      dealer={<div className="dealer-block" />}
      tray={<div className="bj-casino__tray-wrap" />}
      gameState={state}
      focusBoxId="box-test"
      activeBoxId={null}
      showHoleHidden={false}
      protocolPhase="betting"
      bettingOpen
      gameEnded={false}
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

function columnForBox(html: string, slotNumber: number): string {
  const marker = slotNumber === 1 ? 'aria-label="Box 1' : `aria-label="Join box ${slotNumber}`;
  const start = html.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const columnStart = html.lastIndexOf(TABLE_UX.cardViewBoxColumn, start);
  const chipStackEnd = html.indexOf('</div>', html.indexOf(TABLE_UX.cardViewBoxChipStack, start));
  return html.slice(columnStart, chipStackEnd + 6);
}

describe('Card View stable box column', () => {
  it('empty and occupied boxes share the same four-row column structure', () => {
    const html = render(bettingState([10, 5]));
    const occupied = columnForBox(html, 1);
    const empty = columnForBox(html, 2);

    for (const column of [occupied, empty]) {
      expect(column).toContain(TABLE_UX.cardViewBoxValueAbove);
      expect(column).toContain(TABLE_UX.cardViewBoxStakeLabel);
      expect(column).toContain(TABLE_UX.cardViewBoxChipStack);
    }

    expect(occupied).toContain('Bet: 15');
    expect(occupied).toContain('stake-chips--bet');
    expect(occupied).not.toContain(TABLE_UX.cardViewBoxStakeLabelReserved);
    expect(occupied).not.toContain(TABLE_UX.cardViewBoxChipStackReserved);

    expect(empty).toContain(TABLE_UX.cardViewBoxValueReserved);
    expect(empty).toContain(TABLE_UX.cardViewBoxStakeLabelReserved);
    expect(empty).toContain(TABLE_UX.cardViewBoxChipStackReserved);
  });

  it('reserves bet-label and chip-stack placeholders before chips are placed', () => {
    const html = render(bettingState([]));
    const occupied = columnForBox(html, 1);

    expect(occupied).toContain(TABLE_UX.cardViewBoxStakeLabelReserved);
    expect(occupied).toContain(TABLE_UX.cardViewBoxChipStackReserved);
    expect(occupied).not.toContain('stake-chips--bet');
    expect(occupied).not.toContain('bj-phone-view__mini-hand--has-stake');
  });

  it('does not tie tile layout to stake presence', () => {
    const cardSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
    expect(cardSrc).not.toMatch(/showBetStakeChips\s*\?\s*["']bj-phone-view__mini-hand--has-stake["']/);
    expect(cardSrc).not.toMatch(/showStakeRow\s*\?/);

    const layoutCss = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
    expect(layoutCss).toMatch(
      /\.bj-card-layout__boxes \.bj-phone-view__mini-hand-column[\s\S]*grid-template-rows:[\s\S]*var\(--bj-card-box-chip-stack-height\)/,
    );
    expect(layoutCss).toMatch(
      /\.bj-card-layout__boxes \.bj-phone-view__box-chip-stack[\s\S]*max-height:\s*var\(--bj-card-box-chip-stack-height\)/,
    );
  });
});
