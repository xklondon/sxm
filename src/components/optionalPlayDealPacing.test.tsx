import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { OptionalPlayDecisionOverlay } from './OptionalPlayDecisionOverlay';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey, confirmBoxStake, addChipToBoxStake } from '../engine/blackjack';

const noop = () => {};
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

vi.mock('./storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alice', email: 'alice@test.com' }),
  needsLocalProfileSetup: () => false,
  syncAuthEmailToProfile: () => {},
  getPlayerInitials: () => 'AL',
}));

function splittableState(): GameState {
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
      ...actingRound(
        state,
        box1,
        [findCardId(deck, '8'), findCardId(deck, '8')],
        25,
      ),
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

describe('optional play overlay under command', () => {
  it('renders Double and Split when both legal', () => {
    const html = renderToStaticMarkup(
      <OptionalPlayDecisionOverlay
        canDouble
        canSplit
        showDouble
        showSplit
        actionsEnabled
        onDouble={noop}
        onSplit={noop}
      />,
    );
    expect(html).toContain('>Double<');
    expect(html).toContain('>Split<');
  });

  it('renders only Double when split is illegal', () => {
    const html = renderToStaticMarkup(
      <OptionalPlayDecisionOverlay
        canDouble
        canSplit={false}
        showDouble
        showSplit
        actionsEnabled
        onDouble={noop}
        onSplit={noop}
      />,
    );
    expect(html).toContain('>Double<');
    expect(html).not.toContain('>Split<');
  });

  it('renders nothing when neither is legal', () => {
    const html = renderToStaticMarkup(
      <OptionalPlayDecisionOverlay
        canDouble={false}
        canSplit={false}
        showDouble
        showSplit
        actionsEnabled
        onDouble={noop}
        onSplit={noop}
      />,
    );
    expect(html).toBe('');
  });

  it('panel wires overlay in summary and removes table double/split row', () => {
    expect(PANEL_SRC).toContain('OptionalPlayDecisionOverlay');
    expect(PANEL_SRC).toContain('renderOptionalPlayDecisionOverlay');
    expect(PANEL_SRC).toContain('showDouble={false}');
    expect(PANEL_SRC).toContain('showSplit={false}');
  });

  it('panel renders split offer under command zone when legal', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={splittableState()} onGameStateChange={noop} />,
    );
    const commandZone = html.split('bj-table-zone--summary')[1]?.split('bj-table-zone--cards')[0] ?? '';
    expect(commandZone).toContain('>Split<');
  });
});

describe('player actions blocked during pacing hold', () => {
  it('run() returns early when hand transition hold blocks actions', () => {
    expect(PANEL_SRC).toContain('handTransitionHold.playerActionsBlocked');
    expect(PANEL_SRC).toContain('useHandTransitionHold');
  });
});
