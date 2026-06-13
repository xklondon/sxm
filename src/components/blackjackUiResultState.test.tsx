import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { DealerBlock } from './DealerBlock';
import {
  cardAreaOutcomeMarkerText,
  isHandTotalBust,
  resolveCardAreaOutcomeMarker,
} from './cardAreaOutcomeDisplay';
import { mapOutcomeToHandResultStatus } from './boxHandStatusDisplay';
import { formatBoxCardRanksLabel } from './cardDisplay';
import {
  tableAfterStartPlaying,
  tableWithClaimedBox,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';
import type { Rank } from '../types/deck';
import { MOBILE_GAME_OVER_OVERLAY_DELAY_MS } from './roundSummaryOverlayTiming';

const noop = () => {};
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const REVEAL_HOOK_SRC = readFileSync(
  join(process.cwd(), 'src/hooks/useSequentialCardReveal.ts'),
  'utf8',
);

function settledLossState(handTotal: number): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  const ranks: Array<[Rank, Rank]> =
    handTotal === 16
      ? [
          ['10', '6'],
          ['10', '9'],
        ]
      : [
          ['10', '6'],
          ['10', '8'],
        ];
  return {
    ...state,
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
          cardIds: [findCardId(deck, ranks[0]![0]), findCardId(deck, ranks[0]![1])],
          currentBet: 10,
          actionStatus: handTotal > 21 ? 'busted' : 'done',
        },
      },
      outcomes: { [k1]: handTotal > 21 ? 'loss' : 'loss' },
    },
  };
}

function endedState(): GameState {
  const base = tableWithClaimedBox(1);
  return {
    ...base,
    blackjackFlowSettings: {
      ...base.blackjackFlowSettings,
      initialDealMode: 'instant',
    },
    tableMeta: {
      ...base.tableMeta,
      gameStatus: 'ended',
      winnerId: base.tableMeta.ownerPersonId!,
    },
  };
}

describe('card-area outcome markers', () => {
  it('does not show BUST for a losing hand under 21', () => {
    expect(mapOutcomeToHandResultStatus('loss')).toBeNull();
    expect(resolveCardAreaOutcomeMarker(true, 'loss', 'done', 16)).toBeNull();
    expect(resolveCardAreaOutcomeMarker(true, 'loss', 'done', 12)).toBeNull();
  });

  it('shows BUST only when hand total exceeds 21 or action is busted', () => {
    expect(isHandTotalBust(22)).toBe(true);
    expect(isHandTotalBust(16)).toBe(false);
    expect(resolveCardAreaOutcomeMarker(false, undefined, 'busted', 22)).toBe('bust');
    expect(resolveCardAreaOutcomeMarker(true, 'loss', 'busted', 24)).toBe('bust');
    expect(cardAreaOutcomeMarkerText('bust')).toBe('💀 BUST');
  });

  it('shows BLACKJACK for natural two-card 21 immediately', () => {
    expect(resolveCardAreaOutcomeMarker(false, undefined, 'blackjack', 21)).toBe('blackjack');
    expect(resolveCardAreaOutcomeMarker(true, 'blackjack-win', 'done', 21)).toBe('blackjack');
    expect(cardAreaOutcomeMarkerText('blackjack')).toBe('★ BJ');
  });

  it('shows WIN and EVEN for non-blackjack win and push', () => {
    expect(resolveCardAreaOutcomeMarker(true, 'win', 'done', 20)).toBe('win');
    expect(resolveCardAreaOutcomeMarker(true, 'push', 'done', 18)).toBe('even');
    expect(cardAreaOutcomeMarkerText('win')).toBe('😎 WIN');
    expect(cardAreaOutcomeMarkerText('even')).toBe('EVEN');
  });

  it('losing 16 vs bank 21 does not render BUST in cards area markup', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={settledLossState(16)} onGameStateChange={noop} />,
    );
    const cardsArea = html.split('bj-arc--cards')[1]?.split('bj-arc--player-boxes')[0] ?? '';
    expect(cardsArea).not.toContain('💀 BUST');
    expect(cardsArea).not.toContain('>BUST<');
  });
});

describe('player box compact text', () => {
  it('formats rank-only card values without suits', () => {
    expect(formatBoxCardRanksLabel([{ rank: '6' }, { rank: '7' }, { rank: '5' }])).toBe('6, 7, 5');
  });

  it('renders owner name and rank-only composition in player boxes', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const deck = state.deck!;
    const box1 = boxPlayerId(state, 1)!;
    const k1 = blackjackHandKey(box1, 0);
    state = {
      ...state,
      blackjackFlowSettings: {
        ...state.blackjackFlowSettings,
        initialDealMode: 'instant',
      },
      blackjack: {
        ...state.blackjack!,
        status: 'player-turns',
        activeHandKey: k1,
        activePlayerId: box1,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
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
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={state} onGameStateChange={noop} />,
    );
    const boxArea = html.split('bj-arc--player-boxes')[1] ?? '';
    expect(boxArea).toContain('bj-phone-view__mini-hand-name');
    expect(boxArea).toContain('6, 7');
    expect(boxArea).not.toMatch(/6♥|6♠|7♥|7♠/);
    expect(PANEL_SRC).toContain('formatBoxCardRanksLabel');
  });
});

describe('deal/new cards host permission', () => {
  it('disables Deal Cards and New Cards for non-host viewers', () => {
    const dealHtml = renderToStaticMarkup(
      <DealerBlock
        awaitingNextRound={false}
        gameEnded={false}
        onNextRound={noop}
        dealerCards={null}
        protocolPhase="betting"
        bankerReady
        shoeStarted
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
      />,
    );
    expect(dealHtml).toContain('disabled');
    expect(dealHtml).toContain('Deal Cards');

    const nextHtml = renderToStaticMarkup(
      <DealerBlock
        awaitingNextRound
        gameEnded={false}
        onNextRound={noop}
        dealerCards={null}
        protocolPhase="round-complete"
        bankerReady
        shoeStarted
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
      />,
    );
    expect(nextHtml).toContain('New Cards');
    expect(nextHtml).toMatch(/disabled/);
  });

  it('wires deal permission through canCurrentUserDealTable', () => {
    expect(PANEL_SRC).toContain('canCurrentUserDealTable');
    expect(PANEL_SRC).toContain('canUserDealTable');
    expect(PANEL_SRC).toMatch(/function handlePrimaryDealAction\(\) \{[\s\S]*if \(!canUserDealTable\)/);
  });
});

describe('active hand value highlight', () => {
  it('adds active-turn highlight class to card-area hand values', () => {
    expect(PANEL_SRC).toContain('bj-phone-view__box-value--active-turn');
    expect(PANEL_SRC).toMatch(/isActiveHand[\s\S]*bj-phone-view__box-value--active-turn/);
  });
});

describe('game end presentation', () => {
  it('hydrates reveal state when table game ends so overlays can trigger', () => {
    expect(REVEAL_HOOK_SRC).toMatch(/gameStatus === 'ended'[\s\S]*hydrateInstant/);
  });

  it('waits for reveal completion before desktop game summary panel', () => {
    expect(PANEL_SRC).toMatch(
      /showGameOverDesktopPanel[\s\S]*cardRevealComplete/,
    );
  });

  it('renders desktop game summary after ended state with instant dealing', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={endedState()} onGameStateChange={noop} />,
    );
    expect(html).toContain('Game Summary');
    expect(html).toContain('bj-game-over--inline');
  });

  it('uses the same delay constant for mobile game-over overlay', () => {
    expect(PANEL_SRC).toContain('MOBILE_GAME_OVER_OVERLAY_DELAY_MS');
    expect(MOBILE_GAME_OVER_OVERLAY_DELAY_MS).toBe(3000);
  });
});
