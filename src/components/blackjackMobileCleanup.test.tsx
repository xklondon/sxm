import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { TABLE_UX } from './tableUxContract';
import { buildBlackjackCommandText } from './tableCommandDisplay';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const noop = () => {};

const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const DEALER_BLOCK_SRC = readFileSync(join(process.cwd(), 'src/components/DealerBlock.tsx'), 'utf8');

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

function playingState(view: 'full' | 'card' = 'full'): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return {
    ...state,
    selectedSeatId: box1,
    tableViewMode: view,
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

function countMatches(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe('targeted mobile cleanup — card area + actions', () => {
  it('pins mobile Full Table cards zone to natural height above actions', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*flex:\s*0 0 auto/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*justify-content:\s*flex-end/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-table-slot-row\.bj-arc--cards[\s\S]*align-self:\s*end/,
    );
  });

  it('anchors desktop and mobile stacks at bottom of stack band', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__slot--card-column > \.bj-arc__play-zone[\s\S]*align-self:\s*end[\s\S]*justify-content:\s*flex-end/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__slot--card-column > \.bj-arc__play-zone[\s\S]*align-self:\s*end[\s\S]*justify-content:\s*flex-end/,
    );
  });

  it('uses touch-friendly HIT/STAY sizing on mobile', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--actions \.ds-btn--hit[\s\S]*min-height:\s*2\.75rem/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--actions \.ds-btn--stand[\s\S]*min-height:\s*2\.75rem/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--actions \.ds-btn--hit[\s\S]*font-size:\s*0\.82rem/,
    );
  });

  it('keeps mobile actions above cards and restores horizontal felt swipe', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-zone--actions[\s\S]*z-index:\s*6/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-zone--cards[\s\S]*z-index:\s*5/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt[\s\S]*touch-action:\s*pan-x pan-y pinch-zoom/,
    );
    expect(PANEL_SRC).toContain('useMobileBoxSwipeNavigation');
    expect(PANEL_SRC).toContain('mobileFeltTouchHandlers');
  });
});

describe('targeted mobile cleanup — command + game over routes', () => {
  it('renders exactly one command box in mobile Full Table and Card View', () => {
    simulatedWidth = 390;
    for (const view of ['full', 'card'] as const) {
      const html = renderToStaticMarkup(
        <BlackjackPanel
          gameState={playingState(view)}
          onGameStateChange={noop}
        />,
      );
      expect(countMatches(html, 'bj-card-layout__command')).toBe(1);
      expect(countMatches(html, 'dealer-block__command')).toBe(1);
      expect(html).not.toMatch(
        /dealer-block__center-col[\s\S]*dealer-block__command[\s\S]*bj-card-layout__command/,
      );
    }
  });

  it('uses one player-turn command paragraph (no legacy summary lines route)', () => {
    simulatedWidth = 390;
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={playingState('card')} onGameStateChange={noop} />,
    );
    const commandZone =
      html.split('bj-card-layout__command')[1]?.split(TABLE_UX.cardsAreaHero)[0] ?? '';
    expect(commandZone.match(/dealer-block__status--summary/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(commandZone).not.toMatch(
      /<p class="dealer-block__status">[\s\S]*<\/p>[\s\S]*<p class="dealer-block__status dealer-block__status--summary">/,
    );
  });

  it('does not pass command text into dealer block props', () => {
    expect(PANEL_SRC).toContain('omitCommand');
    expect(PANEL_SRC).not.toMatch(/dealerBlockProps[\s\S]*commandMessage:/);
    expect(DEALER_BLOCK_SRC).toMatch(/omitCommand[\s\S]*!omitCommand \?/);
  });

  it('routes game-over copy through overlay only (command zone stays empty)', () => {
    expect(buildBlackjackCommandText({
      gameState: playingState(),
      gameEnded: true,
      gameOverMessage: 'Bank is bust.',
      centerStatus: '',
      protocolPhase: 'round-complete',
      roundSummaryLines: [],
      controllerName: 'Host',
    })).toEqual({ commandMessage: null, commandLines: [] });
    expect(PANEL_SRC).toMatch(/showGameOverActions \? null : tableCommand\.commandMessage/);
  });
});
