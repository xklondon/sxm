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

describe('Card View mini row layout contract', () => {
  it('renders stake under the tile when chips are placed', () => {
    const before = render(bettingState([]));
    const after = render(bettingState([10, 5]));
    expect(before).toContain(TABLE_UX.cardViewBoxColumn);
    expect(before).not.toContain(TABLE_UX.cardViewBoxStake);
    expect(after).toContain(TABLE_UX.cardViewBoxStake);
    expect(after).toContain(TABLE_UX.cardViewBoxStakeLabel);
    expect(after).toContain('Bet: 15');
    expect(after).toContain('stake-chips--bet');
    const columnCountBefore = (before.match(/bj-phone-view__mini-hand-column/g) ?? []).length;
    const columnCountAfter = (after.match(/bj-phone-view__mini-hand-column/g) ?? []).length;
    expect(columnCountBefore).toBe(columnCountAfter);
    expect(columnCountBefore).toBeGreaterThan(0);
  });

  it('CSS fixes mini tile height in the grid boxes row so stake does not expand layout', () => {
    const layoutCss = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
    expect(layoutCss).toContain('--bj-card-row-boxes: 9rem');
    expect(layoutCss).toMatch(
      /\.bj-card-layout__boxes \.bj-phone-view__mini-hand[\s\S]*max-height:\s*var\(--bj-cardview-desktop-mini-hand-height/,
    );
    expect(layoutCss).toMatch(/\.bj-card-layout__boxes \.bj-phone-view__box-stake[\s\S]*flex:\s*0 0 auto/);
    expect(layoutCss).toMatch(/\.bj-card-layout__boxes \.bj-phone-view__mini-row[\s\S]*max-height:\s*100%/);
  });
});
