import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { createNewBlackjackTable } from '../engine/session';
import { startNextRoundOnState } from '../engine/blackjack';
import { blackjackHandKey } from '../engine/blackjack';
import { tableWithClaimedBox, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { buildRoundSummaryOverlayModel } from '../engine/blackjack/roundSummaryOverlay';
import { buildBlackjackCommandText } from './tableCommandDisplay';
import { RoundSummaryOverlay } from './RoundSummaryOverlay';
import { resolveShowRoundSummaryOverlay } from '../types/table';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const FLOW_SETTINGS_SRC = readFileSync(join(process.cwd(), 'src/engine/blackjack/flowSettings.ts'), 'utf8');

function settledRoundState() {
  let state = tableWithClaimedBox(1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      awaitingNextRound: true,
      bettingLocked: true,
      shoeStarted: true,
    },
    blackjack: {
      ...state.blackjack!,
      status: 'resolved' as const,
      isSettled: true,
      dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '8'), findCardId(deck, '7')],
          currentBet: 10,
        },
      },
      outcomes: { [k1]: 'win' as const },
      resultMessages: {},
    },
  };
}

describe('round summary overlay', () => {
  it('defaults round summary overlay setting to off', () => {
    const state = createNewBlackjackTable();
    expect(resolveShowRoundSummaryOverlay(state.tableMeta)).toBe(false);
    expect(state.tableMeta.showRoundSummaryOverlay).toBe(false);
  });

  it('builds per-box overlay entries after settlement', () => {
    const state = settledRoundState();
    const model = buildRoundSummaryOverlayModel(state);
    expect(model).not.toBeNull();
    expect(model!.entries.length).toBeGreaterThan(0);
    expect(model!.entries[0]).toMatchObject({
      boxLabel: expect.stringMatching(/Box/),
      playerName: expect.any(String),
      outcomeLabel: expect.any(String),
    });
    expect(model!.entries[0]!.cardIds.length).toBeGreaterThan(0);
    expect(model!.dealerCardIds.length).toBeGreaterThan(0);
  });

  it('uses short command text instead of full round summary lines', () => {
    const settled = settledRoundState();
    const state = {
      ...settled,
      tableMeta: {
        ...settled.tableMeta,
        awaitingNextRound: false,
      },
    };
    const result = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'ignored',
      protocolPhase: 'round-complete',
      roundSummaryLines: ['Box 1: 20 wins — Alice wins 10.'],
      controllerName: 'Host',
      cardRevealComplete: true,
    });
    expect(result.commandMessage).toBe('Round finished. Summary ready.');
    expect(result.commandLines).toEqual([]);
  });

  it('renders overlay with Play On and Close actions', () => {
    const state = settledRoundState();
    const model = buildRoundSummaryOverlayModel(state)!;
    const html = renderToStaticMarkup(
      <RoundSummaryOverlay
        open
        model={model}
        deck={state.deck}
        onPlayOn={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain('Round Summary');
    expect(html).toContain('Play On');
    expect(html).toContain('Close');
    expect(html).toContain("Don&#x27;t show again");
    expect(html).toContain(model.entries[0]!.boxLabel);
    expect(html).toContain('playing-card');
    expect(html).not.toMatch(/2diamonds|10diamonds|4clubs/);
  });

  it('renders hand value, outcome, and chip delta alongside card visuals', () => {
    const state = settledRoundState();
    const model = buildRoundSummaryOverlayModel(state)!;
    const entry = model.entries[0]!;
    const html = renderToStaticMarkup(
      <RoundSummaryOverlay
        open
        model={model}
        deck={state.deck}
        onPlayOn={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain(String(entry.handValue));
    expect(html).toContain(entry.outcomeLabel);
    expect(html).toContain(entry.netChips > 0 ? `Won ${entry.netChips}c` : `Lost ${Math.abs(entry.netChips)}c`);
  });

  it('supports disabling future overlays from the overlay checkbox', () => {
    const html = renderToStaticMarkup(
      <RoundSummaryOverlay
        open
        model={buildRoundSummaryOverlayModel(settledRoundState())!}
        deck={settledRoundState().deck}
        onPlayOn={() => {}}
        onClose={() => {}}
        onDontShowAgain={() => {}}
      />,
    );
    expect(html).toContain('bj-round-summary__opt-out');
    expect(PANEL_SRC).toContain('onDontShowAgain');
    expect(PANEL_SRC).toContain('showRoundSummaryOverlay: false');
  });

  it('Panel wires overlay when setting is on and round awaits next hand', () => {
    expect(PANEL_SRC).toContain('RoundSummaryOverlay');
    expect(PANEL_SRC).toContain('resolveShowRoundSummaryOverlay');
    expect(PANEL_SRC).toContain('showRoundSummaryOverlay');
    expect(PANEL_SRC).toContain('roundSummaryDelayReady');
    expect(PANEL_SRC).toContain('ROUND_SUMMARY_OVERLAY_DELAY_MS');
    expect(PANEL_SRC).toMatch(/onPlayOn=\{\(\) => \{[\s\S]*handleNextRound/);
  });

  it('suppresses overlay when table setting is off', () => {
    const state = {
      ...settledRoundState(),
      tableMeta: {
        ...settledRoundState().tableMeta,
        showRoundSummaryOverlay: false,
      },
    };
    expect(resolveShowRoundSummaryOverlay(state.tableMeta)).toBe(false);
  });

  it('New Cards starts next betting round without breaking table state', () => {
    const settled = settledRoundState();
    const next = startNextRoundOnState(settled);
    expect(next.tableMeta.awaitingNextRound).toBe(false);
    expect(next.tableMeta.bettingLocked).toBe(false);
  });
});

describe('table center alignment polish', () => {
  it('centers dealer, command, and actions on table axis', () => {
    expect(SHARED_CSS).toContain('--bj-table-center-column-max-width');
    expect(SHARED_CSS).toMatch(/\.bj-table-zone--dealer[\s\S]*align-items:\s*center/);
    expect(SHARED_CSS).toMatch(/\.bj-table-zone--actions[\s\S]*justify-content:\s*center/);
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--dealer[\s\S]*justify-content:\s*center/);
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--summary[\s\S]*align-items:\s*center/);
  });
});

describe('default table flow settings', () => {
  it('defaults new tables to natural dealing and 1 second deal speed', () => {
    expect(FLOW_SETTINGS_SRC).toMatch(/initialDealMode:\s*'natural'/);
    expect(FLOW_SETTINGS_SRC).toMatch(/dealSpeedPreset:\s*'fast'/);
  });
});
