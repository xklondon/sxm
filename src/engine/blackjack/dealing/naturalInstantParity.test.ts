import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../types';
import { tableAfterStartPlaying, boxPlayerId } from '../sanity/fixtures';
import { claimBoxSlot } from '../../session/boxOps';
import { addChipToBoxStake } from '../stakes';
import { createBlackjackShoe, shuffleBlackjackShoe } from '../shoe';
import { dealCardsFromState, shuffleToStartOnState } from '../gameState';
import { clearTableUiEphemeral } from '../../session/inviteJoin';

function projectDeal(state: GameState) {
  const round = state.blackjack;
  const hands = round
    ? Object.values(round.playerHands)
        .map((h) => ({
          bet: h.currentBet,
          cards: h.cardIds.filter(Boolean).length,
        }))
        .sort((a, b) => b.bet - a.bet || b.cards - a.cards)
    : [];
  return {
    status: round?.status,
    dealer: round?.dealerCardIds.filter(Boolean).length ?? 0,
    hands,
  };
}

function readyToDeal(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const boxId = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, boxId, 50);
  const started = shuffleToStartOnState(state);
  return {
    ...started,
    deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'parity-deal-seed'),
    tableMeta: { ...started.tableMeta, bettingLocked: true },
  };
}

function dealWithMode(base: GameState, mode: 'instant' | 'natural'): GameState {
  const prepared = clearTableUiEphemeral({
    ...base,
    blackjackFlowSettings: {
      ...base.blackjackFlowSettings,
      initialDealMode: mode,
    },
  });
  return dealCardsFromState(prepared);
}

describe('natural vs instant authoritative deal', () => {
  it('produces identical round shape after deal on the same table and shoe', () => {
    const base = readyToDeal();
    const instant = dealWithMode(base, 'instant');
    const natural = dealWithMode(base, 'natural');

    expect(projectDeal(natural)).toEqual(projectDeal(instant));
    expect(natural.blackjack?.status).not.toBe('initial-deal');
    expect(instant.blackjack?.status).toBe(natural.blackjack?.status);
  });

  it('deals the same card ids for each hand and dealer', () => {
    const base = readyToDeal();
    const instant = dealWithMode(base, 'instant');
    const natural = dealWithMode(base, 'natural');

    expect(natural.blackjack?.dealerCardIds).toEqual(instant.blackjack?.dealerCardIds);
    for (const key of Object.keys(instant.blackjack!.playerHands)) {
      expect(natural.blackjack!.playerHands[key]!.cardIds).toEqual(
        instant.blackjack!.playerHands[key]!.cardIds,
      );
    }
  });
});
