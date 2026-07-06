import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  areAllPlayerInitialCardsRevealed,
  isDealerHoleRevealPending,
  isDealerHoleRevealStep,
  nextGameplayRevealStep,
  nextSequentialRevealStep,
  waitForInitialDealerHoleHoldMs,
} from '../engine/blackjack/dealing/cardRevealDisplay';
import { getVisibleDealerCardIds } from '../engine/blackjack/protocolState';
import { getDealerDisplayHand } from '../engine/blackjack/dealerDisplay';
import { applyCardVisibility, maxVisibilityForRound } from '../engine/blackjack/dealing/cardRevealDisplay';
import { normalizeFlowSettings } from '../engine/blackjack/flowSettings';
import {
  completeStepwiseInitialDealIfNeeded,
  dealCardsButtonOnState,
} from '../engine/blackjack/gameState';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import { shuffleToStartOnState } from '../engine/blackjack/gameState';
import { tableWithClaimedBox, boxPlayerId } from '../engine/blackjack/sanity/fixtures';

const overlayCss = readFileSync(
  join(process.cwd(), 'src/styles/bj-table-action-overlays.css'),
  'utf8',
);
const shellCss = readFileSync(
  join(process.cwd(), 'src/styles/bj-blackjack-table-shell.css'),
  'utf8',
);

describe('blackjack presentation stability', () => {
  it('action overlay layer stacks above cards and below modals', () => {
    expect(overlayCss).toMatch(/\.bj-table-action-overlays\s*\{[\s\S]*z-index:\s*20/);
    expect(overlayCss).toMatch(/pointer-events:\s*none/);
    expect(overlayCss).toMatch(/overflow:\s*visible/);
  });

  it('insurance and even-money render in canonical overlay slots', () => {
    expect(overlayCss).toMatch(/bj-table-action-overlays__slot--command/);
    expect(overlayCss).toMatch(/bj-table-action-overlays__slot--actions/);
  });

  it('card view desktop dealer stack is not clipped by overflow hidden', () => {
    expect(shellCss).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-dealer-area[\s\S]*overflow:\s*visible/,
    );
    expect(shellCss).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell \.bj-dealer-area \.dealer-block__cards-slot \.dealer-block__cards[\s\S]*overflow:\s*visible/,
    );
  });

  it('gameplay catch-up reveals player cards before dealer during initial deal', () => {
    const visible = { dealer: 1, hands: { 'p:0': 1, 'p2:0': 2 } };
    const target = { dealer: 2, hands: { 'p:0': 2, 'p2:0': 2 } };
    const gameplay = nextGameplayRevealStep(visible, target);
    expect(gameplay?.dealer).toBe(1);
    expect(gameplay?.hands['p:0']).toBe(2);
  });

  it('dealer hole reveal waits until all player initial cards are visible', () => {
    const target = { dealer: 2, hands: { 'a:0': 2, 'b:0': 2 } };
    const beforePlayersDone = { dealer: 1, hands: { 'a:0': 2, 'b:0': 1 } };
    expect(areAllPlayerInitialCardsRevealed(beforePlayersDone, target)).toBe(false);
    expect(isDealerHoleRevealPending(beforePlayersDone, target)).toBe(false);

    const playersDone = { dealer: 1, hands: { 'a:0': 2, 'b:0': 2 } };
    expect(areAllPlayerInitialCardsRevealed(playersDone, target)).toBe(true);
    expect(isDealerHoleRevealPending(playersDone, target)).toBe(true);
    expect(isDealerHoleRevealStep(playersDone, { ...playersDone, dealer: 2 }, target)).toBe(true);
  });

  it('initial dealer hole hold uses global card timing', () => {
    expect(waitForInitialDealerHoleHoldMs({ blackjackFlowSettings: normalizeFlowSettings({ dealSpeedPreset: 'normal' }) })).toBe(3000);
    expect(waitForInitialDealerHoleHoldMs({ blackjackFlowSettings: normalizeFlowSettings({ dealSpeedPreset: 'fast' }) })).toBe(1000);
  });

  it('ordered reveal defers dealer hole until player hands complete', () => {
    const round = {
      status: 'player-turns',
      dealerCardIds: ['d1', 'd2'],
      dealerHoleHidden: true,
      activeHandKey: 'p:0',
      activePlayerId: 'p',
      playerHands: {
        'p:0': { cardIds: ['a', 'b'], playerId: 'p', handIndex: 0, currentBet: 10, actionStatus: 'acting' },
        'p2:0': { cardIds: ['c', 'd'], playerId: 'p2', handIndex: 0, currentBet: 10, actionStatus: 'acting' },
      },
      initialDealHandKeys: ['p:0', 'p2:0'],
    } as unknown as import('../../types/blackjack').BlackjackRound;
    const target = { dealer: 2, hands: { 'p:0': 2, 'p2:0': 2 } };
    const playersDoneDealerPending = { dealer: 1, hands: { 'p:0': 2, 'p2:0': 2 } };
    const stepped = nextSequentialRevealStep(playersDoneDealerPending, target, round, 'player-turns');
    expect(stepped?.dealer).toBe(2);
  });

  it('face-down dealer hole appears in display ids without exposing hole value', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 50);
    state = shuffleToStartOnState(state);
    state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const target = maxVisibilityForRound(state.blackjack!);
    const masked = applyCardVisibility(state, target);
    expect(getVisibleDealerCardIds(masked)).toHaveLength(2);
    const display = getDealerDisplayHand(masked);
    expect(display?.cardIds).toHaveLength(2);
    expect(display?.value).toBeLessThanOrEqual(11);
  });
});
