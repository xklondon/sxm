import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
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
  tableWithClaimedBox,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey, confirmBoxStake, addChipToBoxStake } from '../engine/blackjack';

const noop = () => {};
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

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

  it('renders Play Hand when split is offered', () => {
    const html = renderToStaticMarkup(
      <OptionalPlayDecisionOverlay
        canDouble={false}
        canSplit
        showDouble={false}
        showSplit
        actionsEnabled
        onDouble={noop}
        onSplit={noop}
        onPlayHand={noop}
      />,
    );
    expect(html).toContain('>Split<');
    expect(html).toContain('>Play Hand<');
  });

  it('panel routes Split/Double through shared action row with command parity', () => {
    expect(PANEL_SRC).toContain('resolvePlayerHandActionOptions');
    expect(PANEL_SRC).toContain('showDouble={showDouble}');
    expect(PANEL_SRC).toContain('showSplit={showSplit}');
    expect(PANEL_SRC).not.toContain('renderOptionalPlayDecisionOverlay');
    expect(PANEL_SRC).not.toContain('bj-optional-play-overlay-anchor');
  });

  it('panel renders 2x in actions zone on mobile Card View for hard 9', () => {
    let state = tableWithClaimedBox(1);
    const box1 = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const handKey = blackjackHandKey(box1, 0);
    state = {
      ...state,
      tableViewMode: 'card',
      blackjackSettings: { ...state.blackjackSettings, allowDoubleDown: true, allowSplit: true },
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjack: {
        ...actingRound(state, box1, [findCardId(deck, '5'), findCardId(deck, '4')], 25),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: box1,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
        dealerHoleHidden: true,
      },
    };
    simulatedWidth = 390;
    const html = renderToStaticMarkup(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
    const actionsZone =
      html.split('bj-table-zone--actions')[1]?.split('bj-table-zone--boxes')[0] ?? '';
    expect(actionsZone).toContain('>2×<');
    const commandZone = html.split('bj-table-zone--summary')[1]?.split('bj-table-zone--cards')[0] ?? '';
    expect(commandZone).not.toContain('>Double<');
  });

  it('panel renders split in actions zone on mobile Full Table when legal', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={splittableState()} onGameStateChange={noop} />,
    );
    const actionsZone =
      html.split('bj-table-zone--actions')[1]?.split('bj-table-zone--boxes')[0] ?? '';
    expect(actionsZone).toContain('>Split<');
  });
});

describe('player actions blocked during pacing hold', () => {
  it('run() returns early when hand transition hold blocks actions', () => {
    expect(PANEL_SRC).toContain('handTransitionHold.playerActionsBlocked');
    expect(PANEL_SRC).toContain('useHandTransitionHold');
  });
});
