import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { TABLE_UX } from './tableUxContract';
import { createNewBlackjackTable } from '../engine/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { addChipToBoxStake } from '../engine/blackjack/stakes';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');

const noop = () => {};

function bettingState(stakeChips: number[]): GameState {
  let state = createNewBlackjackTable();
  const boxId = 'box-test';
  const personId = 'person-1';
  state = {
    ...state,
    tableViewMode: 'card',
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

describe('shared player boxes arc', () => {
  it('Panel renders one arc row for Full Table and Card View', () => {
    expect(PANEL_SRC).toContain('function renderPlayerBoxesArc()');
    expect(PANEL_SRC).toContain('bj-arc--player-boxes');
    expect(PANEL_SRC).toContain('playerBoxes={renderPlayerBoxesArc()}');
    expect(PANEL_SRC).toContain('TABLE_UX.fullArcBox');
    expect(CARD_VIEW_SRC).not.toContain('renderPlayerBoxesArc');
    expect(CARD_VIEW_SRC).not.toContain('renderMiniBoxesRow');
  });

  it('Card View boxes zone uses arc smile layout CSS', () => {
    const panelCss = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    const sharedCss = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--boxes \.bj-arc--player-boxes[\s\S]*overflow:\s*hidden/);
    expect(panelCss).toMatch(/\.bj-arc--cards \.bj-arc__slot[\s\S]*transform:\s*rotate\(var\(--arc-rot/);
  });

  it('Card View panel renders shared arc slots with stake chips on occupied box', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={bettingState([10, 5])} onGameStateChange={noop} />,
    );
    expect(html).toContain('bj-arc--player-boxes');
    expect(html).toContain('bj-arc__slot--owned');
    expect(html).toContain(TABLE_UX.fullArcBox);
    expect(html).toContain('stake-chips--bet');
  });
});
