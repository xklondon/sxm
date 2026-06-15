import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { OptionalPlayDecisionOverlay } from './OptionalPlayDecisionOverlay';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';
import { tableAfterStartPlaying, boxPlayerId, findCardId, actingRound } from '../engine/blackjack/sanity/fixtures';
import { addChipToBoxStake, confirmBoxStake } from '../engine/blackjack';
import { cardAreaOutcomeStackBadgeText } from './cardAreaOutcomeDisplay';

const noop = () => {};
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const OPTIONAL_PLAY_CSS = readFileSync(
  join(process.cwd(), 'src/components/OptionalPlayDecisionOverlay.css'),
  'utf8',
);
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_AREA_DISPLAY_SRC = readFileSync(
  join(process.cwd(), 'src/components/cardAreaOutcomeDisplay.ts'),
  'utf8',
);

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

function splittableDesktopState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const box1 = boxPlayerId(state, 1)!;
  const ownerId = state.tableMeta.ownerPersonId!;
  state = addChipToBoxStake(state, box1, 20, ownerId);
  state = confirmBoxStake(state, box1);
  const deck = state.deck!;
  const handKey = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableViewMode: 'full',
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
      dealSpeedPreset: 'slow',
    },
    blackjackSettings: {
      ...state.blackjackSettings,
      allowDoubleDown: true,
      allowSplit: true,
    },
    tableMeta: { ...state.tableMeta, bettingLocked: true },
    blackjack: {
      ...actingRound(state, box1, [findCardId(deck, '8'), findCardId(deck, '8')], 25),
      status: 'player-turns',
      activeHandKey: handKey,
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      dealerHoleHidden: true,
      playerHands: {
        [handKey]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '8'), findCardId(deck, '8')],
          currentBet: 25,
          actionStatus: 'acting',
        },
      },
    },
  };
}

function bustedDesktopState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableViewMode: 'full',
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
    },
    tableMeta: { ...state.tableMeta, awaitingNextRound: true },
    blackjack: {
      ...state.blackjack!,
      status: 'resolved',
      isSettled: true,
      dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '10'), findCardId(deck, '6'), findCardId(deck, '5')],
          currentBet: 10,
          actionStatus: 'busted',
        },
      },
      outcomes: { [k1]: 'loss' },
    },
  };
}

describe('desktop Full Table layout polish', () => {
  it('tightens Hit/Stay to ~10px above player box amount labels on desktop Full Table only', () => {
    expect(CARD_AREA_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-view-full-desktop[\s\S]*--bj-full-desktop-actions-boxes-gap:\s*0\.625rem/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*padding-bottom:\s*var\(--bj-full-desktop-actions-boxes-gap\)/,
    );
  });

  it('adds ~5px gap between card stack bottom and hand value on desktop Full Table', () => {
    expect(CARD_AREA_CSS).toMatch(
      /--bj-full-desktop-stack-value-gap:\s*0\.3125rem/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop[\s\S]*\.bj-phone-view__box-value--card-column-below[\s\S]*margin-top:\s*var\(--bj-full-desktop-stack-value-gap\)/,
    );
  });

  it('clears command box ~3px below Deal/New Cards on desktop Full Table', () => {
    expect(CARD_AREA_CSS).toMatch(
      /--bj-full-desktop-dealer-command-gap:\s*0\.1875rem/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*padding-top:\s*var\(--bj-full-desktop-dealer-command-gap\)/,
    );
  });

  it('nudges card stacks down with the lowered action area on desktop Full Table', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop[\s\S]*\.bj-full-table-card-area[\s\S]*transform:\s*translateY\(18px\)/,
    );
  });

  it('centers optional split overlay above card stacks in cards zone on desktop Full Table', () => {
    expect(PANEL_SRC).toContain('bj-optional-play-overlay-anchor');
    expect(PANEL_SRC).toContain('isFullTableDesktop');
    expect(OPTIONAL_PLAY_CSS).toMatch(
      /\.bj-optional-play-overlay-anchor[\s\S]*z-index:\s*25/,
    );

    simulatedWidth = 1280;
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: splittableDesktopState(), onGameStateChange: noop }),
    );
    const cardsZone =
      html.split('bj-table-zone--cards')[1]?.split('bj-table-zone--actions')[0] ?? '';
    expect(cardsZone).toContain('bj-optional-play-overlay-anchor');
    expect(cardsZone).toContain('>Split<');
    expect(cardsZone).toContain('>Play Hand<');
    const commandZone =
      html.split('bj-table-zone--summary')[1]?.split('bj-table-zone--cards')[0] ?? '';
    expect(commandZone).not.toContain('>Split<');
  });

  it('renders Split and Play Hand buttons in optional play overlay component', () => {
    const html = renderToStaticMarkup(
      createElement(OptionalPlayDecisionOverlay, {
        canDouble: false,
        canSplit: true,
        showDouble: false,
        showSplit: true,
        actionsEnabled: true,
        onDouble: noop,
        onSplit: noop,
        onPlayHand: noop,
      }),
    );
    expect(html).toContain('>Split<');
    expect(html).toContain('>Play Hand<');
  });

  it('does not render AID on desktop Full Table (frozen layout)', () => {
    expect(PANEL_SRC).toContain('showAid={flowSettings.adviceEnabled && !isFullTableDesktop}');
    simulatedWidth = 1280;
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: splittableDesktopState(), onGameStateChange: noop }),
    );
    expect(html).toContain('bj-view-full-desktop');
    expect(html).not.toMatch(/bj-view-full-desktop[\s\S]*>AID</);
  });

  it('renders desktop bust as stack badge inside play-zone, not floating outcome row', () => {
    expect(PANEL_SRC).toContain('bustBadgeOnStack');
    expect(PANEL_SRC).toContain('bj-arc__slot--card-column--stack-outcome');
    expect(PANEL_SRC).toContain('bj-card-outcome-marker--stack-badge');
    expect(PANEL_SRC).toContain('cardAreaOutcomeStackBadgeText');
    expect(CARD_AREA_DISPLAY_SRC).toContain("return 'BUST'");
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-card-outcome-marker--stack-badge[\s\S]*position:\s*absolute/,
    );

    simulatedWidth = 1280;
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: bustedDesktopState(), onGameStateChange: noop }),
    );
    expect(html).toContain('bj-arc__slot--card-column--stack-outcome');
    expect(html).toContain('bj-card-outcome-marker--stack-badge');
    expect(html).toContain('>BUST<');
    const column = html.split('bj-arc__slot--card-column--stack-outcome')[1]?.split('bj-arc--player-boxes')[0] ?? '';
    expect(column.indexOf('bj-arc__play-zone')).toBeLessThan(column.indexOf('bj-card-outcome-marker--stack-badge'));
    expect(column).not.toMatch(/bj-card-outcome-marker--bust[^>]*>[\s\S]*bj-arc__play-zone/);
  });

  it('uses compact bust badge text helper', () => {
    expect(cardAreaOutcomeStackBadgeText('bust')).toBe('BUST');
  });

  it('does not apply desktop polish tokens to mobile Full Table markup', () => {
    simulatedWidth = 390;
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: bustedDesktopState(), onGameStateChange: noop }),
    );
    expect(html).toContain('bj-view-full-mobile');
    expect(html).not.toContain('bj-arc__slot--card-column--stack-outcome');
    expect(html).not.toContain('bj-card-outcome-marker--stack-badge');
    expect(html).not.toContain('bj-optional-play-overlay-anchor');
  });

  it('does not apply desktop Full Table bust stack badge in Card View', () => {
    simulatedWidth = 1280;
    let state = bustedDesktopState();
    state = { ...state, tableViewMode: 'card' };
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
    );
    expect(html).toContain('bj-view-card-desktop');
    expect(html).not.toContain('bj-card-outcome-marker--stack-badge');
    expect(html).not.toContain('bj-optional-play-overlay-anchor');
  });
});
