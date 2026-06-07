import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../../types';
import {
  applyCardVisibility,
  getDisplayedHandValue,
} from './dealing/cardRevealDisplay';
import { getCardDealDelayMs, normalizeFlowSettings } from './flowSettings';
import { getBlackjackProtocolPhase } from './protocol';
import {
  getActiveTurnBoxId,
  showHeroPlayerCards,
} from '../../components/blackjackViewPhase';
import { boxPlayerId, findCardId, tableAfterStartPlaying, actingRound } from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { startNextRoundOnState } from './gameState';
import { blackjackHandKey } from './handKeys';

function maskedTwoCardState() {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const boxId = boxPlayerId(state, 1)!;
  const deck = state.deck!;
  const handKey = blackjackHandKey(boxId, 0);
  const round = actingRound(state, boxId, [findCardId(deck, '6'), findCardId(deck, '7')], 25);
  const full = {
    ...state,
    blackjack: {
      ...round,
      status: 'player-turns' as const,
      activeHandKey: handKey,
    },
  };
  const masked = applyCardVisibility(full, {
    dealer: full.blackjack!.dealerCardIds.filter(Boolean).length,
    hands: { [handKey]: 1 },
  });
  return { masked, full, handKey, boxId };
}

describe('blackjack polish — visible card/value sync', () => {
  it('does not show total before second card is visible', () => {
    const { masked, handKey } = maskedTwoCardState();
    expect(getDisplayedHandValue(masked.deck, masked.blackjack, handKey)).toBe(6);
    expect(masked.blackjack!.playerHands[handKey]!.cardIds.filter(Boolean)).toHaveLength(1);
  });

  it('shows full total once all visible cards are revealed', () => {
    const { full, handKey } = maskedTwoCardState();
    const revealed = applyCardVisibility(full, {
      dealer: full.blackjack!.dealerCardIds.filter(Boolean).length,
      hands: { [handKey]: 2 },
    });
    expect(getDisplayedHandValue(revealed.deck, revealed.blackjack, handKey)).toBe(13);
  });

  it('Card View and Panel use getDisplayedHandValue', () => {
    const cardView = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
    const panel = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(cardView).toContain('getDisplayedHandValue');
    expect(panel).toContain('getDisplayedHandValue');
  });
});

describe('blackjack polish — dealing speed helper', () => {
  it('getCardDealDelayMs reads table deal speed preset', () => {
    const state = {
      blackjackFlowSettings: normalizeFlowSettings({ dealSpeedPreset: 'slow' }),
    } as GameState;
    expect(getCardDealDelayMs(state, 'initial-deal')).toBe(5000);
    expect(getCardDealDelayMs(state, 'double')).toBe(5000);
    expect(getCardDealDelayMs(state, 'dealer')).toBe(5000);
  });

  it('reveal hook uses resolveCardRevealDelayMs and table flow uses getCardDealDelayMs', () => {
    const hook = readFileSync(join(process.cwd(), 'src/hooks/useSequentialCardReveal.ts'), 'utf8');
    const flow = readFileSync(join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'), 'utf8');
    expect(hook).toContain('resolveCardRevealDelayMs');
    expect(hook).not.toMatch(/getCardDealDelayMs\(authoritative, 'initial-deal'\)/);
    expect(flow).toContain('getCardDealDelayMs');
  });
});

describe('blackjack polish — active turn highlight source', () => {
  it('getActiveTurnBoxId follows activeHandKey during player phase', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 2);
    const box2 = boxPlayerId(state, 2)!;
    const handKey = blackjackHandKey(box2, 0);
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, box2, [findCardId(state.deck!, '9'), findCardId(state.deck!, '8')], 10),
        status: 'player-turns',
        activeHandKey: handKey,
      },
    };
    expect(getActiveTurnBoxId(state, 'player')).toBe(box2);
  });

  it('views use getActiveTurnBoxId / activeHandKey for highlight', () => {
    const cardView = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
    const panel = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(cardView).toContain('getActiveTurnBoxId');
    expect(panel).toContain('getActiveTurnBoxId');
  });
});

describe('blackjack polish — settled round card retention', () => {
  it('keeps hero cards visible during round-complete', () => {
    expect(showHeroPlayerCards('round-complete', false, 2)).toBe(true);
  });

  it('clears cards only after Next Round starts new betting cycle', () => {
    const { masked, handKey } = maskedTwoCardState();
    const state = {
      ...masked,
      tableMeta: { ...masked.tableMeta, awaitingNextRound: true, bettingLocked: true },
      blackjack: {
        ...masked.blackjack!,
        status: 'resolved' as const,
        isSettled: true,
      },
    };
    expect(getBlackjackProtocolPhase(state)).toBe('round-complete');
    expect(state.blackjack!.playerHands[handKey]!.cardIds.length).toBeGreaterThan(0);

    const next = startNextRoundOnState(state);
    expect(next.blackjack!.status).toBe('betting');
    expect(
      Object.values(next.blackjack!.playerHands).every(
        (hand) => hand.cardIds.filter(Boolean).length === 0,
      ),
    ).toBe(true);
    expect(next.tableMeta.awaitingNextRound).toBe(false);
  });
});
