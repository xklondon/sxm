import type { GameState, Rank } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey, addChipToBoxStake } from '../engine/blackjack';
import {
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from '../engine/blackjack/sanity/fixtures';

/** Four-box Full Table desktop play state for layout capture / geometry tests. */
export function playingFullTableDesktopState(): GameState {
  let state = tableAfterStartPlaying(500);
  for (let seat = 1; seat <= 4; seat += 1) {
    state = claimBoxSlot(state, seat);
    const boxId = boxPlayerId(state, seat)!;
    state = addChipToBoxStake(state, boxId, seat === 4 ? 50 : 20);
  }
  const deck = state.deck!;
  const box4 = boxPlayerId(state, 4)!;
  const k4 = blackjackHandKey(box4, 0);
  const hands: Record<string, ReturnType<typeof createBlackjackPlayerHand> & { cardIds: string[]; currentBet: number; actionStatus: 'acting' | 'stood' }> = {};
  for (let seat = 1; seat <= 4; seat += 1) {
    const boxId = boxPlayerId(state, seat)!;
    const key = blackjackHandKey(boxId, 0);
    const pairs: Array<[Rank, Rank]> = [
      ['K', '8'],
      ['Q', '7'],
      ['K', '7'],
      ['3', '6'],
    ];
    const [a, b] = pairs[seat - 1]!;
    hands[key] = {
      ...createBlackjackPlayerHand(boxId, 0),
      cardIds: [findCardId(deck, a), findCardId(deck, b)],
      currentBet: seat === 4 ? 50 : 20,
      actionStatus: seat === 4 ? 'acting' : 'stood',
    };
  }
  return {
    ...state,
    tableViewMode: 'full',
    selectedSeatId: box4,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
      adviceEnabled: false,
    },
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: k4,
      activePlayerId: box4,
      dealerCardIds: [findCardId(deck, '8'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: hands,
    },
  };
}
