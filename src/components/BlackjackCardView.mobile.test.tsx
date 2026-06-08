import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlackjackPanel } from './BlackjackPanel';
import { BET_BOX_PULSE, getBoxActivePulseClassName, resolveBoxBorderVisualState } from './cardViewBox';
import { TABLE_UX } from './tableUxContract';
import { createNewBlackjackTable } from '../engine/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import type { GameState } from '../types';

/**
 * Mobile Card View render contract — same canonical markup as desktop Card View;
 * viewport differences are CSS-only (applied by the panel view root class).
 */

const noop = () => {};

function bettingTableWithBox(): { state: GameState; boxId: string } {
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
  state = addChipToBoxStake(state, boxId, 10, personId);
  return { state, boxId };
}

function renderBettingCardPanel(state: GameState): string {
  return renderToStaticMarkup(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
}

describe('mobile Card View render contract', () => {
  it('renders the phone-view root without in-card view toggle', () => {
    const { state } = bettingTableWithBox();
    const html = renderBettingCardPanel(state);
    expect(html).toContain('bj-phone-view');
    expect(html).not.toContain('bj-phone-view__table-btn');
  });

  it('uses hero placeholder and bottom arc player boxes during betting', () => {
    const { state } = bettingTableWithBox();
    const html = renderBettingCardPanel(state);
    expect(html).toContain('bj-phone-view__hand--waiting');
    expect(html).toContain('bj-phone-view__cards-placeholder');
    expect(html).toContain('bj-arc--player-boxes');
    expect(html).toContain(TABLE_UX.tableZoneBoxes);
    expect(html).not.toContain('bj-phone-view__betting-center');
    expect(html).not.toContain('bj-phone-view__bet-chip-wrap--main');
    expect(html).not.toContain('bj-phone-view__betting-stage--row');
    expect(html).toContain('Box 1');
  });

  it('pulses valid betting boxes while betting is open', () => {
    const { state, boxId } = bettingTableWithBox();
    const personId = 'person-1';
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: boxId,
      viewerPersonId: personId,
      selectedBettingBoxId: boxId,
      bettingStage: true,
    });
    expect(getBoxActivePulseClassName(resolved)).toBe(BET_BOX_PULSE);
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain('getBoxActivePulseClassName(borderState)');
    const html = renderBettingCardPanel(state);
    expect(html).toContain('stake-chips--bet');
  });

  it('does not render a side-panel column inside the card view', () => {
    const { state } = bettingTableWithBox();
    const html = renderBettingCardPanel(state);
    const shellStart = html.indexOf(TABLE_UX.tableLayoutShell);
    expect(shellStart).toBeGreaterThan(-1);
    const shellEnd = html.indexOf(TABLE_UX.tableZoneBottom, shellStart);
    const shellMarkup = html.slice(shellStart, shellEnd);
    expect(shellMarkup).not.toContain('bj-accounts-panel');
  });

  it('stops pulsing once betting closes', () => {
    const { state } = bettingTableWithBox();
    const html = renderBettingCardPanel({
      ...state,
      tableMeta: { ...state.tableMeta, bettingLocked: true },
    });
    expect(html).not.toContain('bj-phone-view__bet-chip--pulse');
  });
});
