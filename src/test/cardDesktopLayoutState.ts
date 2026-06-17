import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey, addChipToBoxStake } from '../engine/blackjack';
import {
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from '../engine/blackjack/sanity/fixtures';

export function playingCardDesktopState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  state = addChipToBoxStake(state, box1, 20);
  return {
    ...state,
    tableViewMode: 'card',
    selectedSeatId: box1,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
      adviceEnabled: false,
    },
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: k1,
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '6'), findCardId(deck, '7')],
          currentBet: 20,
          actionStatus: 'acting',
        },
      },
    },
  };
}
