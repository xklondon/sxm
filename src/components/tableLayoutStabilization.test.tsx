import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { BLACKJACK_TABLE_LAYOUT } from './blackjackTableLayout';
import { TABLE_UX } from './tableUxContract';
import { tableAfterStartPlaying, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack';

const { shared: SHARED_CSS, cardLayout: CARD_LAYOUT_CSS } = readBlackjackLayoutCss();
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
      blackjackFlowSettings: {
        ...state.blackjackFlowSettings,
        initialDealMode: 'instant',
      },
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
    const css = SHARED_CSS;
    expect(css).toContain('--bj-table-rail-radius: var(--ds-radius-lg)');
    expect(css).toContain('--bj-table-felt-radius: calc(var(--ds-radius-lg) - 0.15rem)');
    expect(css).not.toContain('50% / 22%');
    expect(css).not.toContain('50% / 20%');
    expect(css).not.toContain('50% / 18%');
    expect(css).not.toContain('50% / 16%');
  });

  it('uses wider shared desktop shell width token', () => {
    const css = SHARED_CSS;
    expect(css).toContain('--bj-shell-width: min(98vw, 86rem)');
    expect(css).toContain('--bj-desktop-table-max-width: var(--bj-shell-width)');
  });

  it('does not clip play area with overflow hidden on desktop felt chain', () => {
    const css = SHARED_CSS;
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

  it('shows bank summary and bank hand inside table shell above dealer', () => {
    for (const width of [1280, 390]) {
      const full = renderAt(width, 'full');
      expect(full).toContain('bj-table-info-bar--felt-row');
      expect(full).toMatch(/bj-table-info-bar__bank-(summary|chips)/);
      expect(full).toContain('bj-table-info-bar--dealer-hand');
      expect(full).toContain('bj-phone-view__box-value--card-column');
      expect(full).toContain('bj-value-chips');
      expect(full).not.toMatch(/bj-value-chips__balance[^>]*>Available:/);
      const shellIdx = full.indexOf(TABLE_UX.tableLayoutShell);
      const infoIdx = full.indexOf('bj-table-info-bar--felt-row');
      expect(shellIdx).toBeGreaterThan(-1);
      expect(infoIdx).toBeGreaterThan(shellIdx);
      expect(full).not.toContain('bj-casino__header-bank');

      const card = renderAt(width, 'card');
      expect(card).toContain('bj-table-info-bar--felt-row');
      expect(card).toMatch(/bj-table-info-bar__bank-(summary|chips)/);
      expect(card).toContain('bj-table-info-bar--dealer-hand');
      expect(card).toContain('bj-phone-view__box-value--card-column');
      expect(card).toContain(TABLE_UX.dealerBankInfo);
      expect(card).not.toContain('bj-casino__header-bank');
    }
  });

  it('keeps canonical zone structure stable across Full and Card views', () => {
    const full = renderAt(1280, 'full');
    expect(full).toContain('bj-dealer-area');
    expect(full).toContain(TABLE_UX.tableZoneSummary);
    expect(full).toContain(TABLE_UX.tableZoneActions);
    expect(full).toContain(TABLE_UX.tableZoneCards);
    expect(full).toContain(TABLE_UX.tableZoneBoxes);
    expect(full).toContain(TABLE_UX.tableZoneBottom);
    expect(full).toContain(BLACKJACK_TABLE_LAYOUT.chipTrayWrap);

    const card = renderAt(1280, 'card');
    expect(card).toContain(TABLE_UX.tableLayoutShell);
    expect(card).toContain('bj-dealer-area');
    expect(card).toContain(TABLE_UX.tableZoneBottom);
    expect(card).toContain(TABLE_UX.cardsAreaHero);
    expect(card).toContain(BLACKJACK_TABLE_LAYOUT.chipTrayWrap);
  });

  it('keeps chip tray mounted during play with chips visible outside betting', () => {
    const playing = renderAt(1280, 'full');
    expect(playing).toContain('bj-value-chips');
    expect(playing).toContain('chip-tray');
    expect(playing).not.toContain(TABLE_UX.trayReserved);
  });

  it('reserves action slot during betting when no player actions show', () => {
    const betting = renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...tableAfterStartPlaying(500), tableViewMode: 'full' }}
        onGameStateChange={noop}
      />,
    );
    expect(betting).toContain('bj-action-row--slot-reserved');
  });

  it('bank visible value excludes hidden hole card in markup', () => {
    const html = renderAt(1280, 'full');
    expect(html).toContain('bj-phone-view__box-value--card-column');
    expect(html).toContain('>7<');
    expect(html).not.toContain('>17<');
  });

  it('player boxes use shared framed mini-hand shell', () => {
    const css = SHARED_CSS;
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
      blackjackFlowSettings: {
        ...state.blackjackFlowSettings,
        initialDealMode: 'instant',
      },
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

  it('renders bank total and bank hand inside table shell above dealer', () => {
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    const shellSrc = readSrc('src/components/BlackjackTableLayoutShell.tsx');
    expect(panelSrc).toContain('tableBankInfo');
    expect(panelSrc).toContain('variant="felt"');
    expect(panelSrc).not.toContain('bj-casino__header-bank');
    expect(shellSrc).toMatch(/tableBankInfo[\s\S]*\{dealer\}/);
    for (const mode of ['full', 'card'] as const) {
      const html = renderAt(1280, mode);
      expect(html).toMatch(/bj-table-info-bar__bank-(summary|chips)/);
      expect(html).toContain('bj-phone-view__box-value--card-column');
      expect(html).toContain('bj-table-info-bar--felt-row');
      expect(html).not.toContain('bj-casino__header-bank');
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
      /bj-phone-view__box-value--above[\s\S]*bj-phone-view__mini-hand--full-arc[\s\S]*bj-phone-view__mini-stake-slot/,
    );
    expect(full).not.toMatch(/bj-phone-view__mini-hand--full-arc[\s\S]*bj-cards-fan/);
  });

  it('Full Table keeps play-phase stake chips in player boxes (frozen contract)', () => {
    const full = renderAt(1280, 'full');
    expect(full).toMatch(/bj-phone-view__mini-hand--full-arc[\s\S]*bj-phone-view__mini-hand-value/);
    expect(full).not.toMatch(/bj-phone-view__mini-hand--full-arc[\s\S]*stake-chips--bet/);
  });

  it('Card View shows in-box hand total during play (chips hidden inside box)', () => {
    const card = renderAt(1280, 'card');
    expect(card).toMatch(/bj-phone-view__mini-hand--full-arc[\s\S]*bj-phone-view__mini-hand-value/);
    expect(card).not.toMatch(/bj-phone-view__mini-hand--full-arc[\s\S]*stake-chips--bet/);
  });

  it('Card View uses fixed flex-column shell with bottom-anchored compact boxes', () => {
    const layoutCss = CARD_LAYOUT_CSS;
    const sharedCss = SHARED_CSS;
    const cardCss = readSrc('src/components/BlackjackCardView.css');
    expect(layoutCss).toContain('--bj-card-row-boxes: var(--bj-zone-boxes-height');
    expect(layoutCss).toContain('--bj-card-row-hero-min: 0');
    expect(layoutCss).toMatch(/\.bj-table-layout-shell[\s\S]*flex-direction:\s*column/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*height:\s*var\(--bj-zone-boxes-height\)/);
    expect(cardCss).not.toContain('.bj-phone-view.bj-phone-view--phased');
    const card = renderAt(1280, 'card');
    expect(card).toContain(TABLE_UX.tableLayoutShell);
    expect(card).toContain(TABLE_UX.tableZoneBoxes);
    expect(card).toContain(TABLE_UX.fullArcBox);
    expect(card).toContain('bj-arc--player-boxes');
    const betting = renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...tableAfterStartPlaying(500), tableViewMode: 'card' }}
        onGameStateChange={noop}
      />,
    );
    expect(betting).toContain('dealer-block__command');
    expect(betting).not.toContain(TABLE_UX.summaryPlaceholder);
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
      expect(html).toContain(TABLE_UX.tableLayoutShell);
      expect(html).toContain(TABLE_UX.tableZoneSummary);
      expect(html).toContain(TABLE_UX.cardsAreaHero);
      expect(html).toContain(TABLE_UX.tableZoneActions);
      expect(html).toContain(TABLE_UX.tableZoneBoxes);
      expect(html).toContain(TABLE_UX.tableZoneBottom);
    }
  });
});
