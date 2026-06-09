import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { DealerBlock } from './DealerBlock';
import { TABLE_UX } from './tableUxContract';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

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
  return {
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
  };
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

    const shuffle = renderDealerBlock({
      shoeStarted: false,
      bettingOpen: true,
      hasStakes: false,
      bankerReady: false,
    });
    expect(shuffle).toContain('Shuffle to start');
    expect(shuffle).toContain('disabled');
    expect(shuffle).toContain(TABLE_UX.dealerActionReserved);
  });

  it('uses compact total badge class in Card View hero markup', () => {
    const html = renderCardPanel(playingState());
    expect(html).toContain(TABLE_UX.cardViewTotalCompact);
    const layoutCss = readSrc('src/styles/bj-card-layout.css');
    expect(layoutCss).toContain('--bj-card-total-font-size: 0.54rem');
  });

  it('uses increased hero card size tokens inside hero row', () => {
    const layoutCss = readSrc('src/styles/bj-card-layout.css');
    expect(layoutCss).toContain('--bj-card-hero-card-width: min(22vw, 10rem)');
    expect(layoutCss).toContain('--bj-card-hero-card-max-height: min(32vw, 14rem)');
    expect(layoutCss).toContain('--bj-card-hero-card-max-height: min(22vh, 9.5rem)');
    expect(layoutCss).toContain('--bj-card-hero-card-aspect-ratio: 5 / 7');
    expect(layoutCss).toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*width:\s*var\(--bj-card-hero-card-width\)/,
    );
  });

  it('uses compact table action buttons in Card View actions row', () => {
    const html = renderCardPanel(playingState());
    expect(html).toContain('bj-table-actions__btn--sm');
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    expect(sharedCss).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions__btn--sm[\s\S]*font-size:/,
    );
  });

  it('does not introduce page scroll when cards are dealt', () => {
    const layoutCss = readSrc('src/styles/bj-card-layout.css');
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    const panelCss = readSrc('src/components/BlackjackPanel.css');
    expect(sharedCss).toMatch(/\.bj-table-layout-shell[\s\S]*overflow:\s*hidden/);
    expect(panelCss).toMatch(/\.bj-view-card-desktop[\s\S]*overflow-x:\s*hidden/);
    expect(layoutCss).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*visible/);
    expect(layoutCss).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__hand[\s\S]*min-height:\s*0/);
  });

  it('renders hand value above shared arc player box tile', () => {
    const html = renderCardPanel(playingState());
    const slot = arcBoxSlot(html, 1);
    expect(slot).toContain('bj-phone-view__box-value--above');
    expect(slot.indexOf('bj-phone-view__box-value--above')).toBeLessThan(slot.indexOf('bj-phone-view__mini-hand--full-arc'));
    expect(slot).toContain('13');
  });

  it('shared arc player boxes use the same mini-hand shell as Full Table', () => {
    const html = renderCardPanel(playingState());
    const slot = arcBoxSlot(html, 1);
    expect(slot).toContain(TABLE_UX.fullArcBox);
    expect(slot).toContain('bj-phone-view__mini-hand-head');
    expect(slot).toContain('bj-phone-view__bet-chip--pulse');
  });

  it('renders stake chips under shared arc player box tile', () => {
    const html = renderCardPanel(playingState());
    const slot = arcBoxSlot(html, 1);
    expect(slot).toContain('stake-chips--bet');
    expect(slot).toContain('bj-phone-view__mini-stake-slot');
  });
});
