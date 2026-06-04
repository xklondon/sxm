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

function bettingCardViewWithStake(): { state: GameState; boxId: string; html: string } {
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
  state = addChipToBoxStake(state, boxId, 5, personId);

  const html = renderToStaticMarkup(
    <BlackjackCardView
      gameState={state}
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

  return { state, boxId, html };
}

describe('Card View betting chips and layout', () => {
  it('renders chip stack on selected bottom box tile', () => {
    const { html } = bettingCardViewWithStake();
    expect(html).toContain('stake-chips--bet');
    expect(html).toContain('bj-phone-view__mini-stake-slot');
    expect(html).toContain('bj-phone-view__mini-hand--has-stake');
    expect(html).toContain('bj-phone-view__mini-hand--active');
    expect(html).toContain('aria-current="true"');
    expect(html.indexOf('bj-phone-view__mini-stake-slot')).toBeGreaterThan(-1);
    expect(html.indexOf('bj-phone-view__mini-hand--active')).toBeLessThan(
      html.indexOf('bj-phone-view__mini-stake-slot'),
    );
    expect(html).not.toContain('bj-phone-view__bet-chip-wrap--main');
    expect(html).not.toContain('bj-phone-view__bet-chip--hero');
  });

  it('reserves hero total slot without Betting/Bet label text', () => {
    const { html } = bettingCardViewWithStake();
    expect(html).toContain('bj-phone-view__total--placeholder');
    expect(html).toContain('bj-phone-view__hand-meta');
    expect(html).not.toMatch(/>Betting</);
    expect(html).not.toMatch(/>Bet \d+</);
    expect(html).toContain('bj-phone-view__cards-placeholder');
    expect(html).toContain('bj-phone-view__hero-actions--placeholder');
  });

  it('betting and playing share hero/total/box-strip slots', () => {
    const betting = bettingCardViewWithStake().html;
    const slots = [
      'bj-phone-view__slot--stage',
      'bj-phone-view__hand-meta',
      'bj-phone-view__cards-slot',
      'bj-phone-view__slot--actions',
      'bj-phone-view__slot--boxes',
      'bj-phone-view__mini-row',
    ];
    for (const slot of slots) {
      expect(betting).toContain(slot);
    }
  });

  it('desktop Card View has no horizontal overflow contract', () => {
    const panelCss = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    const cardCss = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
    expect(panelCss).toMatch(/\.bj-view-card-desktop[\s\S]*overflow-x:\s*hidden/);
    expect(panelCss).toMatch(/\.bj-casino\.bj-view-card-desktop[\s\S]*overflow-x:\s*hidden/);
    expect(panelCss).toMatch(
      /\.bj-view-card-desktop \.bj-phone-view__mini-row[\s\S]*overflow-x:\s*auto/,
    );
    expect(panelCss).toMatch(
      /\.bj-casino\[data-device-view='desktop'\]\.bj-view-card-desktop \.bj-casino__this-table--float[\s\S]*max-width:/,
    );
    expect(cardCss).toMatch(/\.bj-phone-view[\s\S]*overflow-x:\s*hidden/);
    expect(panelCss).toMatch(/\.bj-view-card-desktop \.dealer-block[\s\S]*padding:\s*0\.1rem/);
  });
});
