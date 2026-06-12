import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { TableInfoBar } from './TableInfoBar';
import { TableDetailsPanelContent } from './TableDetailsPanel';
import { insuranceWinPayout } from '../engine/blackjack/rules';
import {
  formatBoxNetResultLabel,
  resolveBoxBetAmountDuringPlay,
  resolveBoxNetChipsForHands,
} from './boxBetResultDisplay';
import {
  cardAreaOutcomeMarkerText,
  resolveCardAreaOutcomeMarker,
} from './cardAreaOutcomeDisplay';
import {
  incrementBlackjackCountsOnSettlement,
  formatBlackjackCountByBoxLabel,
} from '../engine/session/tableBlackjackStats';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { completeBankingOnState } from '../engine/blackjack/gameState';
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

function activePlayBoxState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableViewMode: 'full',
    tableMeta: { ...state.tableMeta, bettingLocked: true },
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '8'), findCardId(deck, '7')],
          currentBet: 25,
          actionStatus: 'acting',
        },
      },
    },
  };
}

function settledBoxState(outcome: 'win' | 'loss' | 'push' | 'blackjack-win'): GameState {
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
          cardIds: [findCardId(deck, 'A'), findCardId(deck, 'K')],
          currentBet: 10,
        },
      },
      outcomes: { [k1]: outcome },
    },
  };
}

describe('blackjack protocol UI fixes — insurance', () => {
  it('insurance UI and help text say pays 2:1', () => {
    expect(readSrc('src/components/tableCommandDisplay.ts')).toContain(
      'Insurance pays 2:1 when the dealer has blackjack.',
    );
    expect(readSrc('src/components/BlackjackPanel.tsx')).toContain('hintText="Insurance pays 2:1"');
    expect(readSrc('src/components/BlackjackFeltClothLayer.tsx')).toContain('Insurance pays 2:1');
  });

  it('insuranceWinPayout returns 2:1 total (bet plus twice the bet)', () => {
    expect(insuranceWinPayout(10)).toBe(30);
    expect(insuranceWinPayout(5)).toBe(15);
  });
});

describe('blackjack protocol UI fixes — bank display', () => {
  it('felt row renders Bank: name chips without Bank Total label', () => {
    const feltHtml = renderToStaticMarkup(
      <TableInfoBar gameState={dealerHandInfoState()} viewerPersonId={null} variant="felt" />,
    );
    expect(feltHtml).not.toContain('Bank Total:');
    expect(feltHtml).toMatch(/bj-table-info-bar__bank-(summary|chips)/);
  });

  it('dealer row shows hand value only with card-column value classes', () => {
    const dealerHtml = renderToStaticMarkup(
      <TableInfoBar gameState={dealerHandInfoState()} viewerPersonId={null} variant="dealer" />,
    );
    expect(dealerHtml).not.toContain('Bank:');
    expect(dealerHtml).not.toContain('Bank Hand:');
    expect(dealerHtml).not.toContain('Bank has ');
    expect(dealerHtml).toContain('bj-phone-view__box-value--card-column');
    expect(dealerHtml).not.toContain('bj-bank-hand__value');
  });
});

describe('blackjack protocol UI fixes — player box bet and net', () => {
  it('shows bet amount during active play', () => {
    expect(resolveBoxBetAmountDuringPlay(false, 0, 25)).toBe(25);
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={activePlayBoxState()} onGameStateChange={noop} />,
    );
    expect(html).toContain('>25<');
  });

  it('shows net won/lost after round settlement', () => {
    expect(formatBoxNetResultLabel(10)).toBe('+10');
    expect(formatBoxNetResultLabel(-10)).toBe('-10');
    expect(formatBoxNetResultLabel(0)).toBe('EVEN');

    const winRound = settledBoxState('win').blackjack!;
    const handKey = Object.keys(winRound.playerHands)[0]!;
    expect(
      resolveBoxNetChipsForHands(winRound, [handKey], 1.5),
    ).toBe(10);

    const winHtml = renderToStaticMarkup(
      <BlackjackPanel gameState={settledBoxState('win')} onGameStateChange={noop} />,
    );
    expect(winHtml).toContain('>+10<');

    const lossHtml = renderToStaticMarkup(
      <BlackjackPanel gameState={settledBoxState('loss')} onGameStateChange={noop} />,
    );
    expect(lossHtml).toContain('>-10<');
  });
});

describe('blackjack protocol UI fixes — card area outcome markers', () => {
  it('maps outcomes to fun card-area markers', () => {
    expect(resolveCardAreaOutcomeMarker(true, 'blackjack-win', 'done')).toBe('blackjack');
    expect(cardAreaOutcomeMarkerText('blackjack')).toBe('BLACKJACK');
    expect(cardAreaOutcomeMarkerText('win')).toContain('WIN');
    expect(cardAreaOutcomeMarkerText('bust')).toContain('BUST');
    expect(cardAreaOutcomeMarkerText('even')).toContain('EVEN');
  });

  it('renders outcome markers in cards area only', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={settledBoxState('win')} onGameStateChange={noop} />,
    );
    const cardsArea = html.split('bj-arc--cards')[1]?.split('bj-arc--player-boxes')[0] ?? '';
    expect(cardsArea).toContain('bj-card-outcome-marker');
    expect(cardsArea).toContain('WIN');
    expect(cardsArea).not.toContain('bj-hand-status');

    const boxArea = html.split('bj-arc--player-boxes')[1] ?? '';
    expect(boxArea).not.toContain('bj-card-outcome-marker');
    expect(boxArea).not.toContain('>WIN<');
  });
});

describe('blackjack protocol UI fixes — blackjack count per box', () => {
  it('increments blackjack count on settlement and displays in table details', () => {
    const settled = settledBoxState('blackjack-win');
    const nextMeta = incrementBlackjackCountsOnSettlement(settled, settled.blackjack!);
    expect(nextMeta.blackjackCountBySlot?.[1]).toBe(1);

    const label = formatBlackjackCountByBoxLabel(nextMeta.blackjackCountBySlot, [1]);
    expect(label).toBe('Box 1: 1');

    const detailsHtml = renderToStaticMarkup(
      <TableDetailsPanelContent
        playingFor="$5"
        minimumBet={5}
        canChangeMinBet={false}
        onChangeMinBet={noop}
        deckCount={6}
        totalCards={312}
        remaining={300}
        hasDeck
        dealSpeedLabel="Normal"
        canChangeDealSpeed={false}
        onCycleDealSpeed={noop}
        protocolLabel="Las Vegas"
        canChangeProtocol={false}
        onChangeProtocol={noop}
        gameEnded={false}
        blackjackCountByBox={label}
      />,
    );
    expect(detailsHtml).toContain('Black Jacks per Box');
    expect(detailsHtml).toContain('Box 1: 1');
  });

  it('completeBankingOnState increments blackjack counts', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const box1 = boxPlayerId(state, 1)!;
    const k1 = blackjackHandKey(box1, 0);
    const deck = state.deck!;
    state = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        status: 'banking',
        isSettled: false,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
        dealerHoleHidden: false,
        outcomes: { [k1]: 'blackjack-win' },
        resultMessages: { [k1]: 'Blackjack paid' },
        playerHands: {
          [k1]: {
            ...createBlackjackPlayerHand(box1, 0),
            cardIds: [findCardId(deck, 'A'), findCardId(deck, 'K')],
            currentBet: 10,
            naturalSettled: true,
            actionStatus: 'blackjack',
          },
        },
      },
    };
    const after = completeBankingOnState(state);
    expect(after.tableMeta.blackjackCountBySlot?.[1]).toBe(1);
  });
});
