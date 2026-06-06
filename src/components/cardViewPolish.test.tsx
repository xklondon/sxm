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

function miniBoxColumn(html: string, slotNumber: number): string {
  const marker = `aria-label="Box ${slotNumber}`;
  const start = html.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const sectionMarker = 'data-sxm-section="sxm-player-box"';
  const columnStart = html.lastIndexOf(sectionMarker, start);
  expect(columnStart).toBeGreaterThan(-1);
  const nextBox = html.indexOf(sectionMarker, columnStart + sectionMarker.length);
  const sliceEnd = nextBox > columnStart ? nextBox : html.indexOf('bj-card-layout__tray', columnStart);
  return html.slice(columnStart, sliceEnd > columnStart ? sliceEnd : undefined);
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
    expect(layoutCss).toContain('--bj-card-hero-card-width: min(19vw, 7.5rem)');
    expect(layoutCss).toContain('--bj-card-hero-card-max-height: min(26vw, 10.5rem)');
    expect(layoutCss).toContain('--bj-card-hero-card-aspect-ratio: 5 / 7');
    expect(layoutCss).toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*width:\s*var\(--bj-card-hero-card-width\)/,
    );
  });

  it('uses compact secondary action buttons in Card View actions row', () => {
    const html = renderCardPanel(playingState());
    expect(html).toContain(TABLE_UX.cardViewActionCompact);
    const layoutCss = readSrc('src/styles/bj-card-layout.css');
    expect(layoutCss).toMatch(
      /\.bj-card-layout__actions \.bj-phone-view__action-bar-extra--compact[\s\S]*min-height:\s*var\(--bj-card-action-secondary-height\)/,
    );
  });

  it('does not introduce page scroll when cards are dealt', () => {
    const layoutCss = readSrc('src/styles/bj-card-layout.css');
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    expect(layoutCss).toMatch(/\.bj-card-layout[\s\S]*overflow:\s*hidden/);
    expect(sharedCss).toMatch(/\.bj-view-card-desktop \.bj-phone-view\.bj-card-layout[\s\S]*overflow:\s*hidden/);
    expect(layoutCss).toMatch(/\.bj-card-layout__hero[\s\S]*overflow:\s*hidden/);
    expect(layoutCss).toMatch(/\.bj-card-layout__hero \.bj-phone-view__hand[\s\S]*min-height:\s*0/);
  });

  it('renders box value/status above the tile frame', () => {
    const html = renderCardPanel(playingState());
    const column = miniBoxColumn(html, 1);
    expect(column).toContain(TABLE_UX.cardViewBoxValueAbove);
    expect(column).toContain('13');
    const valueIdx = column.indexOf(TABLE_UX.cardViewBoxValueAbove);
    const buttonIdx = column.indexOf('bj-phone-view__mini-hand--active');
    expect(valueIdx).toBeGreaterThan(-1);
    expect(buttonIdx).toBeGreaterThan(valueIdx);
  });

  it('renders mini dealt cards inside the top of the tile', () => {
    const html = renderCardPanel(playingState());
    const column = miniBoxColumn(html, 1);
    const buttonOpen = column.indexOf('bj-phone-view__mini-hand--active');
    const stackIdx = column.indexOf('bj-phone-view__mini-hand-card-stack', buttonOpen);
    const buttonClose = column.indexOf('</button>', buttonOpen);
    expect(stackIdx).toBeGreaterThan(buttonOpen);
    expect(stackIdx).toBeLessThan(buttonClose);
    expect(column).toContain('bj-phone-view__mini-card');
  });

  it('renders bet/stake value under the tile using existing wager data', () => {
    const html = renderCardPanel(playingState());
    const column = miniBoxColumn(html, 1);
    expect(column).toContain(TABLE_UX.cardViewBoxChipStack);
    expect(column).toContain(TABLE_UX.cardViewBoxStakeLabel);
    expect(column).toContain('Bet: 50');
    const buttonClose = column.indexOf('</button>');
    const betIdx = column.indexOf(TABLE_UX.cardViewBoxStakeLabel);
    const chipIdx = column.indexOf(TABLE_UX.cardViewBoxChipStack);
    expect(betIdx).toBeGreaterThan(buttonClose);
    expect(chipIdx).toBeGreaterThan(betIdx);
  });
});
