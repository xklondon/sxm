import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { TableInfoBar } from './TableInfoBar';
import { boxValueSpanClassName } from './boxHandValueDisplay';
import {
  handResultStatusText,
  mapOutcomeToHandResultStatus,
  resolveBoxHandResultStatus,
  shouldShowBoxHandResultMarkers,
} from './boxHandStatusDisplay';
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

function dealerHandInfoState(): GameState {
  let state = tableAfterStartPlaying(500);
  const deck = state.deck!;
  return {
    ...state,
    blackjack: {
      ...state.blackjack!,
      dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
      dealerHoleHidden: true,
    },
  };
}

function settledBoxState(outcome: 'win' | 'loss' | 'push'): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableMeta: { ...state.tableMeta, awaitingNextRound: true },
    tableViewMode: 'full',
    blackjack: {
      ...state.blackjack!,
      status: 'resolved',
      isSettled: true,
      dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '8'), findCardId(deck, '7')],
          currentBet: 10,
        },
      },
      outcomes: { [k1]: outcome },
    },
  };
}

describe('blackjack visual status — outcome mapping', () => {
  it('maps settled outcomes to WIN, BUST, and EVEN box text', () => {
    expect(mapOutcomeToHandResultStatus('win')).toBe('win');
    expect(mapOutcomeToHandResultStatus('loss')).toBe('bust');
    expect(mapOutcomeToHandResultStatus('push')).toBe('push');
    expect(handResultStatusText('win')).toBe('WIN');
    expect(handResultStatusText('bust')).toBe('BUST');
    expect(handResultStatusText('push')).toBe('EVEN');
  });

  it('shows markers only after round resolution', () => {
    const round = settledBoxState('win').blackjack!;
    const handKey = Object.keys(round.playerHands)[0]!;
    expect(
      shouldShowBoxHandResultMarkers({
        awaitingNextRound: false,
        protocolPhase: 'player',
        round,
      }),
    ).toBe(true);
    expect(resolveBoxHandResultStatus(round, handKey, false)).toBeNull();
    expect(resolveBoxHandResultStatus(round, handKey, true)).toBe('win');
  });
});

describe('blackjack visual status — hand values', () => {
  it('applies player hand value emphasis class', () => {
    expect(boxValueSpanClassName(true, false)).toContain('bj-player-hand-value--emphasis');
    expect(boxValueSpanClassName(true, false, 'win')).toContain('bj-phone-view__box-value--win');
    expect(boxValueSpanClassName(true, false, 'push')).toContain('bj-phone-view__box-value--even');
  });

  it('wraps bank hand number in bj-bank-hand__value', () => {
    const dealerHtml = renderToStaticMarkup(
      <TableInfoBar gameState={dealerHandInfoState()} viewerPersonId={null} variant="dealer" />,
    );
    expect(dealerHtml).toContain('bj-bank-hand__value');
    expect(readSrc('src/components/TableInfoBar.css')).toContain('.bj-bank-hand__value');
  });
});

describe('blackjack visual status — end-of-round box labels', () => {
  it('renders WIN, BUST, and EVEN text on player boxes only', () => {
    const winHtml = renderToStaticMarkup(
      <BlackjackPanel gameState={settledBoxState('win')} onGameStateChange={noop} />,
    );
    expect(winHtml).toContain('>WIN<');
    expect(winHtml).toContain('bj-phone-view__box-value--win');
    expect(winHtml).not.toContain('bj-hand-status');

    const bustHtml = renderToStaticMarkup(
      <BlackjackPanel gameState={settledBoxState('loss')} onGameStateChange={noop} />,
    );
    expect(bustHtml).toContain('>BUST<');
    expect(bustHtml).not.toContain('bj-hand-status--bust');

    const pushHtml = renderToStaticMarkup(
      <BlackjackPanel gameState={settledBoxState('push')} onGameStateChange={noop} />,
    );
    expect(pushHtml).toContain('>EVEN<');
    expect(pushHtml).toContain('bj-phone-view__box-value--even');
  });

  it('does not render result badges in the large cards area', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={settledBoxState('loss')} onGameStateChange={noop} />,
    );
    const cardsArea = html.split('bj-arc--cards')[1]?.split('bj-arc--player-boxes')[0] ?? '';
    expect(cardsArea).not.toContain('bj-hand-status');
    expect(cardsArea).not.toContain('>WIN<');
    expect(cardsArea).not.toContain('>EVEN<');
  });
});

describe('blackjack visual status — mobile Card View', () => {
  it('uses numeric-only hero value class on mobile Card View', () => {
    const cardViewSrc = readSrc('src/components/BlackjackCardView.tsx');
    expect(cardViewSrc).toContain('bj-card-view__hero-value');
    expect(cardViewSrc).toContain("deviceView === 'mobile'");
    expect(cardViewSrc).toContain('String(heroDisplayValue)');
  });

  it('centers Stay and Hit Me vertically in mobile Card View CSS', () => {
    const css = readSrc('src/components/BlackjackCardView.css');
    expect(css).toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__play-area--controls[\s\S]*align-items:\s*center/,
    );
    expect(css).toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__side-action[\s\S]*align-self:\s*center/,
    );
    expect(css).toContain('.bj-view-card-mobile .bj-card-view__hero-value');
  });
});
