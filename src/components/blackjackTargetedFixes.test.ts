import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { BlackjackCardView } from './BlackjackCardView';
import { playingFullTableDesktopState } from '../test/fullTableDesktopLayoutState';
import {
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from '../engine/blackjack/sanity/fixtures';
import { blackjackHandKey } from '../engine/blackjack';

const TARGETED_CSS = readFileSync(
  join(process.cwd(), 'src/styles/bj-blackjack-targeted-fixes.css'),
  'utf8',
);
const PORTRAIT_CSS = readFileSync(
  join(process.cwd(), 'src/styles/bj-card-mobile-portrait-layout.css'),
  'utf8',
);
const LANDSCAPE_CSS = readFileSync(
  join(process.cwd(), 'src/styles/bj-mobile-landscape-layout.css'),
  'utf8',
);
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');

const noop = () => {};

function mobileCardHeroState(actionStatus: 'blackjack' | 'busted'): GameState {
  let state = tableWithClaimedBox(1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const handKey = blackjackHandKey(box1, 0);
  const ace = findCardId(deck, 'A');
  const king = findCardId(deck, 'K');
  const ten = findCardId(deck, '10');
  const nine = findCardId(deck, '9');
  const cardIds =
    actionStatus === 'blackjack' ? [ace, king] : [ten, nine, findCardId(deck, '5')];
  return {
    ...state,
    tableViewMode: 'card',
    selectedSeatId: box1,
    blackjack: {
      ...(state.blackjack ?? { status: 'player-turns', playerHands: {}, dealerCardIds: [], dealerHoleHidden: true }),
      status: 'player-turns',
      activeHandKey: handKey,
      activePlayerId: box1,
      playerHands: {
        [handKey]: {
          playerId: box1,
          handIndex: 0,
          cardIds,
          currentBet: 25,
          actionStatus,
          doubled: false,
          fromSplit: false,
          bustSettled: actionStatus === 'busted',
        },
      },
    },
  };
}

describe('Blackjack targeted fixes', () => {
  it('Full Table play boxes zone avoids overflow-y auto during deal/play', () => {
    expect(TARGETED_CSS).toMatch(/data-bj-phase='playing'[\s\S]*overflow-y:\s*hidden/);
    expect(TARGETED_CSS).toMatch(/data-bj-phase='dealing'[\s\S]*overflow-y:\s*hidden/);
    expect(TARGETED_CSS).not.toMatch(/data-bj-phase='playing'[\s\S]*overflow-y:\s*auto/);
  });

  it('mobile Card View portrait hero cards fill cards area with 70×100px floor', () => {
    expect(PORTRAIT_CSS).toContain('min-width: 4.375rem');
    expect(PORTRAIT_CSS).toContain('min-height: 6.25rem');
    expect(PORTRAIT_CSS).toMatch(/92cqh|78cqw/);
  });

  it('mobile Full Table command box is not zero-height in shared CSS', () => {
    const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--summary \.bj-card-layout__command,\s*\n\s*\.bj-view-full-mobile\[data-phase='player'\]/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--summary \.bj-card-layout__command,\s*\n\s*\.bj-view-card-mobile/,
    );
  });

  it('mobile Card View renders bust/blackjack badges on hero cards area', () => {
    expect(CARD_VIEW_SRC).toContain('bj-card-view__hero-stack-badge');
    expect(CARD_VIEW_SRC).toContain('cardAreaOutcomeStackBadgeText');
    expect(PORTRAIT_CSS).toContain('.bj-card-view__hero-stack-badge');

    const bustState = mobileCardHeroState('busted');
    const box1 = boxPlayerId(bustState, 1)!;
    const handKey = blackjackHandKey(box1, 0);
    const bustHtml = renderToStaticMarkup(
      createElement(BlackjackCardView, {
        gameState: bustState,
        logicalGameState: bustState,
        deviceView: 'mobile',
        segment: 'all',
        focusBoxId: box1,
        activeBoxId: box1,
        heroHandKeyOverride: handKey,
        protocolPhase: 'player',
        cardRevealComplete: true,
        bettingOpen: false,
        gameEnded: false,
        onBack: noop,
      }),
    );
    expect(bustHtml).toContain('bj-card-view__hero-stack-badge');
    expect(bustHtml).toContain('BUST');
  });

  it('engine bank-draw skip tests live in roundFlow.terminal.test.ts', () => {
    const src = readFileSync(join(process.cwd(), 'src/engine/blackjack/roundFlow.ts'), 'utf8');
    expect(src).toContain("hand.actionStatus === 'blackjack'");
    expect(src).toContain('return false');
    expect(src).toContain('isHandTerminalBeforeBankDraw');
  });

  it('desktop game-over table overlay is wired in BlackjackPanel', () => {
    expect(PANEL_SRC).toContain('bj-game-over-table-overlay');
    expect(PANEL_SRC).toContain('showGameOverDesktopTableOverlay');
  });

  it('mobile landscape layout uses isolated 900px landscape media query', () => {
    expect(LANDSCAPE_CSS).toMatch(
      /@media \(max-width: 900px\) and \(orientation: landscape\)/,
    );
    expect(LANDSCAPE_CSS).toContain('.bj-view-card-mobile .bj-table-layout-shell > .bj-table-zone--boxes');
  });

  it('desktop Full Table playing markup still renders without bj-casino scroll trap', () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, {
        gameState: playingFullTableDesktopState(),
        onGameStateChange: noop,
      }),
    );
    expect(html).toContain('bj-view-full-desktop');
    expect(html).toContain('bj-table-zone--boxes');
  });
});
