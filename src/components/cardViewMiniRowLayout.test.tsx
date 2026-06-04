import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../types';
import { BlackjackCardView } from './BlackjackCardView';
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
  it('reserves stake slot on every mini tile before and after chips', () => {
    const before = render(bettingState([]));
    const after = render(bettingState([10, 5]));
    expect(before).toContain('bj-phone-view__mini-stake-slot');
    expect(after).toContain('bj-phone-view__mini-stake-slot');
    const slotCountBefore = (before.match(/bj-phone-view__mini-stake-slot/g) ?? []).length;
    const slotCountAfter = (after.match(/bj-phone-view__mini-stake-slot/g) ?? []).length;
    expect(slotCountBefore).toBe(slotCountAfter);
    expect(slotCountBefore).toBeGreaterThan(0);
  });

  it('CSS fixes mini tile and row height so chips do not expand layout', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
    expect(css).toMatch(/\.bj-phone-view__mini-hand[\s\S]*min-height:\s*5\.5rem/);
    expect(css).toMatch(/\.bj-phone-view__mini-stake-slot[\s\S]*min-height:\s*2\.35rem/);
    expect(css).toMatch(/\.bj-phone-view__mini-row[\s\S]*min-height:\s*6\.25rem/);
    expect(css).not.toMatch(/\.bj-phone-view__mini-hand--has-stake[\s\S]*min-height:\s*4\.25rem/);
  });
});
