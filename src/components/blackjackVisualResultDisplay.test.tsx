import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { boxHadActiveHandInRound } from './boxBetResultDisplay';
import { resolveCardAreaOutcomeMarker } from './cardAreaOutcomeDisplay';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const noop = () => {};

const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

function settledMultiBoxState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 2);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const box2 = boxPlayerId(state, 2)!;
  const k1 = blackjackHandKey(box1, 0);
  const k2 = blackjackHandKey(box2, 0);
  return {
    ...state,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
    },
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
          currentBet: 200,
        },
        [k2]: {
          ...createBlackjackPlayerHand(box2, 0),
          cardIds: [findCardId(deck, '6'), findCardId(deck, '5')],
          currentBet: 300,
        },
      },
      outcomes: { [k1]: 'loss', [k2]: 'loss' },
    },
  };
}

describe('blackjack visual result display', () => {
  it('desktop net result uses compact net-result class', () => {
    expect(PANEL_SRC).toContain('boxStakeLabelClassName');
    expect(readFileSync(join(process.cwd(), 'src/components/boxHandValueDisplay.ts'), 'utf8')).toContain(
      'BOX_NET_RESULT',
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--player-boxes \.bj-phone-view__box-value--net-result/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--player-boxes \.bj-phone-view__box-value--net-result[\s\S]*font-size:\s*0\.58rem/,
    );
  });

  it('unplayed box does not qualify for EVEN net result', () => {
    const round = settledMultiBoxState().blackjack!;
    expect(boxHadActiveHandInRound(round, [])).toBe(false);
    expect(boxHadActiveHandInRound(round, [Object.keys(round.playerHands)[0]!])).toBe(true);
  });

  it('empty occupied box renders no EVEN in player-box band', () => {
    let state = settledMultiBoxState();
    state = claimBoxSlot(state, 4);
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={state} onGameStateChange={noop} />,
    );
    const boxArea = html.split('bj-arc--player-boxes')[1] ?? '';
    const joinBox = boxArea.split('Join box 4')[0]?.split('bj-arc__slot').pop() ?? '';
    expect(joinBox).not.toContain('>EVEN<');
  });

  it('blackjack marker resolves before round settlement', () => {
    expect(resolveCardAreaOutcomeMarker(false, undefined, 'blackjack')).toBe('blackjack');
    expect(resolveCardAreaOutcomeMarker(false, 'blackjack-win', 'done')).toBe('blackjack');
  });

  it('mobile card view hides hero value when showing resolved outcome marker', () => {
    expect(CARD_VIEW_SRC).toContain('hideHeroValueOnMobile');
    expect(CARD_VIEW_SRC).toContain('bj-card-view__hero-outcome');
    expect(CARD_VIEW_SRC).toContain('cardAreaOutcomeMarkerText');
  });

  it('mobile full-table arc keeps card column numeric value when outcome marker shows', () => {
    expect(PANEL_SRC).not.toContain('hideCardValueOnMobile');
    expect(PANEL_SRC).toContain('cardColumnValueLabel = valueLabel');
  });

  it('mobile tray plaques use narrower mobile-specific sizing', () => {
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-value-chips[\s\S]*--chip-plaque-visual-width:\s*2\.85rem/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-value-chips \.chip-token--plaque[\s\S]*--chip-plaque-font:\s*0\.64rem/,
    );
    expect(CHIP_CSS).toMatch(/\.chip-token--plaque[\s\S]*--chip-plaque-width:\s*5\.5rem/);
  });
});
