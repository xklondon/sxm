import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { DealerBlock } from './DealerBlock';
import { TABLE_UX } from './tableUxContract';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
  withInstantInitialDeal,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';

const { shared: SHARED_CSS, cardLayout: CARD_LAYOUT_CSS } = readBlackjackLayoutCss();
const noop = () => {};

let simulatedWidth = 390;
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

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function renderDealerBlock(overrides: Partial<Parameters<typeof DealerBlock>[0]> = {}) {
  return renderToStaticMarkup(
    <DealerBlock
      awaitingNextRound={false}
      gameEnded={false}
      onNextRound={noop}
      dealerCards={null}
      protocolPhase="betting"
      bankerReady
      shoeStarted={false}
      bettingOpen
      canUserDealTable={false}
      canDeal={false}
      hasStakes
      onShuffleToStart={noop}
      onDealCards={noop}
      onDealNextCard={noop}
      onDrawBank={noop}
      initialDealManual={false}
      bankDrawManual={false}
      {...overrides}
    />,
  );
}

function playingState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return withInstantInitialDeal({
    ...state,
    selectedSeatId: box1,
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: k1,
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '6'), findCardId(deck, '7')],
          currentBet: 50,
          actionStatus: 'acting',
        },
      },
    },
  });
}

function renderCardPanel(state: GameState): string {
  return renderToStaticMarkup(
    <BlackjackPanel gameState={{ ...state, tableViewMode: 'card' }} onGameStateChange={noop} />,
  );
}

function arcBoxSlot(html: string, slotNumber: number): string {
  const marker = `aria-label="Box ${slotNumber}`;
  const start = html.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const slotStart = html.lastIndexOf('bj-arc__slot', start);
  expect(slotStart).toBeGreaterThan(-1);
  const nextSlot = html.indexOf('bj-arc__slot', slotStart + 1);
  return html.slice(slotStart, nextSlot > slotStart ? nextSlot : undefined);
}

describe('Card View polish guards', () => {
  it('keeps dealer primary action mounted but disabled outside betting', () => {
    const playing = renderDealerBlock({
      protocolPhase: 'player',
      bettingOpen: false,
      shoeStarted: true,
    });
    expect(playing).toContain(TABLE_UX.dealerActionReserved);
    expect(playing).toContain('Deal Cards');
    expect(playing).toContain('disabled');
    expect(playing).toContain('dealer-block__action--disabled');

    const firstStart = renderDealerBlock({
      shoeStarted: false,
      bettingOpen: true,
      hasStakes: false,
      bankerReady: false,
    });
    expect(firstStart).toContain('Deal Cards');
    expect(firstStart).toContain('disabled');
    expect(firstStart).toContain(TABLE_UX.dealerActionReserved);
  });

  it('uses dealer-value hero total token in Card View hero markup', () => {
    const html = renderCardPanel(playingState());
    expect(html).toContain('bj-card-view__hero-value');
    expect(html).toContain('bj-player-hand-value--emphasis');
    const layoutCss = CARD_LAYOUT_CSS;
    expect(layoutCss).toContain('bj-card-view__hero-value');
  });

  it('uses increased hero card size tokens inside hero row', () => {
    const layoutCss = CARD_LAYOUT_CSS;
    expect(layoutCss).toMatch(/--bj-card-hero-card-width:\s*clamp\(/);
    expect(layoutCss).toMatch(/--bj-card-hero-card-max-height:\s*clamp\(/);
    expect(layoutCss).toContain('--bj-card-hero-card-aspect-ratio: 5 / 7');
    expect(layoutCss).toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*width:\s*var\(--bj-card-hero-card-width\)/,
    );
  });

  it('uses compact table action buttons in Card View actions row', () => {
    simulatedWidth = 390;
    const html = renderCardPanel(playingState());
    expect(html).toContain('ds-btn--hit');
    const sharedCss = SHARED_CSS;
    expect(sharedCss).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions__btn--sm[\s\S]*font-size:/,
    );
  });

  it('does not introduce page scroll when cards are dealt', () => {
    const layoutCss = CARD_LAYOUT_CSS;
    const sharedCss = SHARED_CSS;
    const panelCss = readSrc('src/components/BlackjackPanel.css');
    expect(sharedCss).toMatch(/\.bj-table-layout-shell[\s\S]*overflow:\s*hidden/);
    expect(panelCss).toMatch(/\.bj-view-card-desktop[\s\S]*overflow-x:\s*hidden/);
    expect(layoutCss).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*visible/);
    expect(layoutCss).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__hand[\s\S]*min-height:\s*0/);
  });

  it('renders bet amount above shared arc player box tile', () => {
    const html = renderCardPanel(playingState());
    const slot = arcBoxSlot(html, 1);
    expect(slot).toContain('bj-phone-view__box-value--above');
    expect(slot.indexOf('bj-phone-view__box-value--above')).toBeLessThan(slot.indexOf('bj-phone-view__mini-hand--full-arc'));
    expect(slot).toContain('>50<');
  });

  it('shared arc player boxes use the same mini-hand shell as Full Table', () => {
    const html = renderCardPanel(playingState());
    const slot = arcBoxSlot(html, 1);
    const heroZone = html.split('bj-cards-area--hero')[1]?.split('bj-table-zone--actions')[0] ?? '';
    expect(slot).toContain(TABLE_UX.fullArcBox);
    expect(slot).toContain('bj-phone-view__mini-hand-head');
    expect(slot).toContain('bj-phone-view__box-value--active-turn');
    expect(slot).toContain('bj-box--turn');
  });

  it('renders in-box hand total under shared arc player box tile during play', () => {
    const html = renderCardPanel(playingState());
    const slot = arcBoxSlot(html, 1);
    expect(slot).toContain('bj-phone-view__mini-hand-value');
    expect(slot).not.toContain('stake-chips--bet');
    expect(slot).toContain('bj-phone-view__mini-stake-slot');
  });
});
