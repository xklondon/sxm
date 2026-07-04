import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import {
  BET_BOX_PULSE,
  getBoxActivePulseClassName,
  resolveBoxBorderVisualState,
} from './cardViewBox';
import { TABLE_UX } from './tableUxContract';
import { createNewBlackjackTable } from '../engine/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { addChipToBoxStake } from '../engine/blackjack/stakes';

const { shared: SHARED_CSS, shell: SHELL_CSS } = readBlackjackLayoutCss();
const noop = () => {};

let simulatedWidth = 1280;
const globalRef = globalThis as unknown as { window?: unknown };
const hadWindow = 'window' in globalRef;

beforeAll(() => {
  globalRef.window = {
    matchMedia: (query: string) => {
      const m = /max-width:\s*(\d+)/.exec(query);
      const max = m ? Number(m[1]) : Number.POSITIVE_INFINITY;
      return {
        matches: simulatedWidth <= max,
        media: query,
        addEventListener: noop,
        removeEventListener: noop,
        addListener: noop,
        removeListener: noop,
        onchange: null,
        dispatchEvent: () => false,
      };
    },
  };
});

afterAll(() => {
  if (!hadWindow) {
    delete globalRef.window;
  }
});

function bettingPanelWithStake(viewportWidth = 1280): { state: GameState; boxId: string; html: string } {
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
  state = addChipToBoxStake(state, boxId, 5, personId);

  simulatedWidth = viewportWidth;
  const html = renderToStaticMarkup(<BlackjackPanel gameState={state} onGameStateChange={noop} />);

  return { state, boxId, html };
}

describe('Card View betting chips and layout', () => {
  it('renders chip stack on selected bottom box tile', () => {
    const { state, boxId, html } = bettingPanelWithStake();
    expect(html).toContain('stake-chips--bet');
    expect(html).toContain(TABLE_UX.fullArcBox);
    expect(html).toContain('bj-phone-view__mini-stake-slot');
    expect(html).not.toContain('bj-phone-view__mini-hand--has-stake');
    expect(html).not.toContain('bj-phone-view__bet-chip-wrap--main');
    expect(html).not.toContain('bj-phone-view__bet-chip--hero');
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: boxId,
      viewerPersonId: 'person-1',
      selectedBettingBoxId: boxId,
      openStake: 15,
      bettingStage: true,
    });
    expect(getBoxActivePulseClassName(resolved)).toBe(BET_BOX_PULSE);
    const boxesStart = html.indexOf(TABLE_UX.tableZoneBoxes);
    expect(boxesStart).toBeGreaterThan(-1);
    const stakeIdx = html.indexOf('stake-chips--bet', boxesStart);
    expect(stakeIdx).toBeGreaterThan(boxesStart);
  });

  it('reserves hero total slot without Betting/Bet label text', () => {
    const { html } = bettingPanelWithStake(390);
    expect(html).toContain('bj-phone-view__total--placeholder');
    expect(html).toContain('bj-phone-view__hand-meta');
    expect(html).not.toMatch(/>Betting</);
    expect(html).not.toMatch(/>Bet \d+</);
    expect(html).toContain('bj-phone-view__cards-placeholder');
  });

  it('betting and playing share hero/total/box-strip slots', () => {
    const betting = bettingPanelWithStake(390).html;
    const slots = [
      TABLE_UX.cardsAreaHero,
      'bj-phone-view__hand-meta',
      'bj-phone-view__cards-slot',
      TABLE_UX.tableZoneActions,
      TABLE_UX.tableZoneBoxes,
      'bj-arc--player-boxes',
    ];
    for (const slot of slots) {
      expect(betting).toContain(slot);
    }
  });

  it('desktop Card View has no horizontal overflow contract', () => {
    const sharedCss = SHARED_CSS;
    const panelCss = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    const cardCss = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
    expect(sharedCss).toMatch(/\.bj-casino\.bj-view-card-desktop[\s\S]*overflow:\s*hidden/);
    expect(sharedCss).toMatch(/\.bj-table-desktop-shell[\s\S]*overflow:\s*hidden/);
    expect(SHELL_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*overflow:\s*hidden/,
    );
    expect(sharedCss).toMatch(/\.bj-casino__this-table--dock[\s\S]*flex:\s*0 0 12\.5rem/);
    expect(cardCss).toMatch(/\.bj-phone-view[\s\S]*overflow-x:\s*hidden/);
    expect(panelCss).not.toMatch(/\.bj-view-card-desktop \.dealer-block[\s\S]*padding:\s*0\.1rem/);
  });
});
