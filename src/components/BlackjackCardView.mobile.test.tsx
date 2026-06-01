import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlackjackCardView } from './BlackjackCardView';
import { createNewBlackjackTable } from '../engine/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import type { GameState } from '../types';

/**
 * Mobile Card View render contract. We render the canonical stitched-card view
 * (BlackjackCardView) with isMobile so we assert the actual markup phones get:
 * a phone-view root, betting boxes that pulse, an ordered box label, the hero,
 * and crucially NO side-panel column inside the play area.
 */

const noop = () => {};

function bettingTableWithBox(): { state: GameState; boxId: string } {
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
  state = addChipToBoxStake(state, boxId, 10, personId);
  return { state, boxId };
}

function renderBettingCardView(state: GameState, boxId: string): string {
  return renderToStaticMarkup(
    <BlackjackCardView
      gameState={state}
      isMobile
      focusBoxId={boxId}
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

describe('mobile Card View render contract', () => {
  it('renders the phone-view root and a Full Table switch affordance', () => {
    const { state, boxId } = bettingTableWithBox();
    const html = renderBettingCardView(state, boxId);
    expect(html).toContain('bj-phone-view');
    expect(html).toContain('Full Table');
  });

  it('renders the active/selected box as the betting hero with an ordered label', () => {
    const { state, boxId } = bettingTableWithBox();
    const html = renderBettingCardView(state, boxId);
    expect(html).toContain('bj-phone-view__bet-chip--hero');
    expect(html).toContain('Box 1');
  });

  it('pulses valid betting boxes while betting is open', () => {
    const { state, boxId } = bettingTableWithBox();
    const html = renderBettingCardView(state, boxId);
    expect(html).toContain('bj-phone-view__bet-chip--pulse');
  });

  it('does not render a side-panel column inside the card view', () => {
    const { state, boxId } = bettingTableWithBox();
    const html = renderBettingCardView(state, boxId);
    expect(html).not.toContain('bj-accounts-panel');
  });

  it('stops pulsing once betting closes', () => {
    const { state, boxId } = bettingTableWithBox();
    const html = renderToStaticMarkup(
      <BlackjackCardView
        gameState={state}
        isMobile
        focusBoxId={boxId}
        activeBoxId={null}
        showHoleHidden={false}
        protocolPhase="player"
        bettingOpen={false}
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
    expect(html).not.toContain('bj-phone-view__bet-chip--pulse');
  });
});
