import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { BLACKJACK_TABLE_LAYOUT } from './blackjackTableLayout';
import { TABLE_UX } from './tableUxContract';
import { tableAfterStartPlaying, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('table layout stabilization contract', () => {
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
            currentBet: 10,
            actionStatus: 'acting',
          },
        },
      },
    };
  }

  function renderAt(width: number, mode: 'full' | 'card'): string {
    simulatedWidth = width;
    return renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...playingState(), tableViewMode: mode }}
        onGameStateChange={noop}
      />,
    );
  }

  it('uses rounded-rectangle table radii instead of oval clipping on desktop', () => {
    const css = readSrc('src/styles/bj-table-shared.css');
    expect(css).toContain('--bj-table-rail-radius: var(--ds-radius-lg)');
    expect(css).toContain('--bj-table-felt-radius: calc(var(--ds-radius-lg) - 0.15rem)');
    expect(css).not.toContain('50% / 22%');
    expect(css).not.toContain('50% / 20%');
    expect(css).not.toContain('50% / 18%');
    expect(css).not.toContain('50% / 16%');
  });

  it('uses wider shared desktop shell width token', () => {
    const css = readSrc('src/styles/bj-table-shared.css');
    expect(css).toContain('--bj-desktop-table-max-width: min(98vw, 86rem)');
  });

  it('does not clip play area with overflow hidden on desktop felt chain', () => {
    const css = readSrc('src/styles/bj-table-shared.css');
    expect(css).toMatch(/\.bj-view-full-desktop \.bj-casino__felt[\s\S]*overflow:\s*visible/);
    expect(css).toMatch(/\.bj-view-full-desktop \.bj-casino__felt-main[\s\S]*overflow:\s*visible/);
    expect(css).toMatch(/\.bj-view-full-desktop \.bj-arc[\s\S]*overflow:\s*visible/);
  });

  it('Full Table renders visible cards via vertical stack above boxes', () => {
    const full = renderAt(1280, 'full');
    expect(full).toContain(TABLE_UX.arcCards);
    expect(full).toContain(TABLE_UX.arcCardsStackVertical);
    expect(full).toContain(TABLE_UX.arcCardsStack);
    expect(full).toContain('playing-card');
    expect(full).not.toMatch(/bj-phone-view__mini-hand-card-stack[\s\S]*playing-card/);
    expect(full).not.toContain(TABLE_UX.cardsFan);
  });

  it('shows bank value, bank chips in table chrome', () => {
    for (const width of [1280, 390]) {
      const full = renderAt(width, 'full');
      expect(full).toContain(TABLE_UX.headerBankInfo);
      expect(full).toContain('Bank:');
      expect(full).toContain('Bank chips:');
      expect(full).toContain('bj-casino__player-balance');
      expect(full).toContain('You:');
      const headerEnd = full.indexOf('</header>');
      const infoIdx = full.indexOf(TABLE_UX.headerBankInfo);
      expect(headerEnd).toBeGreaterThan(-1);
      expect(infoIdx).toBeGreaterThan(-1);
      expect(infoIdx).toBeLessThan(headerEnd);

      const card = renderAt(width, 'card');
      expect(card).toContain(TABLE_UX.headerBankInfo);
      expect(card).toContain('Bank:');
      expect(card).toContain('Bank chips:');
      expect(card).not.toContain(TABLE_UX.dealerBankInfo);
      const titleIdx = card.indexOf('BLACKJACK');
      const cardHeaderEnd = card.indexOf('</header>');
      const headerInfoIdx = card.indexOf(TABLE_UX.headerBankInfo);
      expect(headerInfoIdx).toBeGreaterThan(titleIdx);
      expect(headerInfoIdx).toBeLessThan(cardHeaderEnd);
    }
  });

  it('keeps canonical zone structure stable across Full and Card views', () => {
    const full = renderAt(1280, 'full');
    expect(full).toContain(TABLE_UX.tableZoneDealer);
    expect(full).toContain(TABLE_UX.tableZoneSummary);
    expect(full).toContain(TABLE_UX.tableZoneActions);
    expect(full).toContain(TABLE_UX.tableZoneCards);
    expect(full).toContain(TABLE_UX.tableZoneBoxes);
    expect(full).toContain(TABLE_UX.tableZoneBottom);
    expect(full).toContain(BLACKJACK_TABLE_LAYOUT.chipTrayWrap);

    const card = renderAt(1280, 'card');
    expect(card).toContain(TABLE_UX.cardLayout);
    expect(card).toContain(TABLE_UX.cardLayoutDealer);
    expect(card).toContain(TABLE_UX.cardLayoutTray);
    expect(card).toContain(BLACKJACK_TABLE_LAYOUT.chipTrayWrap);
  });

  it('reserves tray slot outside betting to prevent layout jump', () => {
    const playing = renderAt(1280, 'full');
    expect(playing).toContain(TABLE_UX.trayReserved);
  });

  it('reserves action slot during betting when no player actions show', () => {
    const betting = renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...tableAfterStartPlaying(500), tableViewMode: 'full' }}
        onGameStateChange={noop}
      />,
    );
    expect(betting).toContain(TABLE_UX.actionsPlaceholder);
  });

  it('bank visible value excludes hidden hole card in markup', () => {
    const html = renderAt(1280, 'full');
    expect(html).toContain('Bank: 7');
    expect(html).not.toContain('Bank: 17');
  });

  it('player boxes use shared framed mini-hand shell', () => {
    const css = readSrc('src/styles/bj-table-shared.css');
    expect(css).toContain('--bj-seat-frame-shadow');
    expect(css).toMatch(/\.bj-phone-view__mini-hand[\s\S]*box-shadow:\s*var\(--bj-seat-frame-shadow\)/);
  });
});

describe('table layout polish contract', () => {
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
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
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
            currentBet: 10,
            actionStatus: 'acting',
          },
        },
      },
    };
  }

  function renderAt(width: number, mode: 'full' | 'card'): string {
    simulatedWidth = width;
    return renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...playingState(), tableViewMode: mode }}
        onGameStateChange={noop}
      />,
    );
  }

  it('centers BLACKJACK title with bank chips under title in header', () => {
    const css = readSrc('src/components/BlackjackPanel.css');
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    expect(css).toMatch(/\.bj-casino__title[\s\S]*grid-column:\s*2/);
    expect(panelSrc).toContain('TABLE_UX.tableHeader');
    expect(panelSrc).toContain('bj-casino__header-bank');
    expect(panelSrc).toContain('variant="header"');
    for (const mode of ['full', 'card'] as const) {
      const html = renderAt(1280, mode);
      expect(html).toContain(TABLE_UX.tableHeader);
      expect(html).toContain('BLACKJACK');
      const headerEnd = html.indexOf('</header>');
      const infoIdx = html.indexOf(TABLE_UX.headerBankInfo);
      expect(headerEnd).toBeGreaterThan(-1);
      expect(infoIdx).toBeGreaterThan(-1);
      expect(infoIdx).toBeLessThan(headerEnd);
    }
  });

  it('Full Table arc stacks cards vertically above each box shell', () => {
    const full = renderAt(1280, 'full');
    expect(full).toContain('bj-arc__cards--stack-vertical');
    expect(full).toContain('bj-arc__cards-stack');
    expect(full).toMatch(
      /bj-table-zone--cards[\s\S]*bj-arc__cards-stack[\s\S]*bj-table-zone--boxes[\s\S]*bj-phone-view__mini-hand--full-arc/,
    );
    expect(full).toMatch(
      /bj-phone-view__mini-hand--full-arc[\s\S]*bj-phone-view__box-value[\s\S]*bj-phone-view__mini-stake-slot/,
    );
    expect(full).not.toMatch(/bj-phone-view__mini-hand--full-arc[\s\S]*bj-cards-fan/);
  });

  it('Full Table shows stake chips during play phase', () => {
    const full = renderAt(1280, 'full');
    expect(full).toMatch(/bj-phone-view__mini-hand--full-arc[\s\S]*stake-chips--bet/);
  });

  it('Card View uses fixed six-row grid with bottom-anchored compact boxes', () => {
    const layoutCss = readSrc('src/styles/bj-card-layout.css');
    const cardCss = readSrc('src/components/BlackjackCardView.css');
    expect(layoutCss).toContain('--bj-card-row-boxes: 9rem');
    expect(layoutCss).toContain('--bj-card-row-hero-min: 11rem');
    expect(layoutCss).toMatch(/\.bj-card-layout[\s\S]*grid-template-rows/);
    expect(layoutCss).toContain('Do not position boxes with flex or phase-dependent margins');
    expect(cardCss).not.toContain('.bj-phone-view.bj-phone-view--phased');
    const card = renderAt(1280, 'card');
    expect(card).toContain(TABLE_UX.cardLayout);
    expect(card).toContain(TABLE_UX.cardLayoutBoxes);
    expect(card).toContain(TABLE_UX.cardViewCompactBox);
    const betting = renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...tableAfterStartPlaying(500), tableViewMode: 'card' }}
        onGameStateChange={noop}
      />,
    );
    expect(betting).toContain(TABLE_UX.cardLayoutSummaryPlaceholder);
  });

  it('Card View zones exist across betting and play phases', () => {
    const betting = renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...tableAfterStartPlaying(500), tableViewMode: 'card' }}
        onGameStateChange={noop}
      />,
    );
    const playing = renderAt(1280, 'card');
    for (const html of [betting, playing]) {
      expect(html).toContain(TABLE_UX.cardLayout);
      expect(html).toContain(TABLE_UX.cardLayoutSummary);
      expect(html).toContain(TABLE_UX.cardLayoutHero);
      expect(html).toContain(TABLE_UX.cardLayoutActions);
      expect(html).toContain(TABLE_UX.cardLayoutBoxes);
      expect(html).toContain(TABLE_UX.cardLayoutTray);
    }
  });
});
