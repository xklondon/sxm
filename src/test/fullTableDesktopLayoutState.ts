import type { GameState, Rank } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey, addChipToBoxStake } from '../engine/blackjack';
import {
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from '../engine/blackjack/sanity/fixtures';

function withPlayingDesktopShell(state: GameState): GameState {
  return {
    ...state,
    tableViewMode: 'full',
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
      adviceEnabled: false,
    },
  };
}

function buildHandsForSeats(
  state: GameState,
  seatCards: Array<[Rank, Rank] | [Rank, Rank, Rank] | [Rank, Rank, Rank, Rank]>,
  actionStatus: 'acting' | 'stood' = 'stood',
): Record<string, ReturnType<typeof createBlackjackPlayerHand> & { cardIds: string[]; currentBet: number; actionStatus: 'acting' | 'stood' }> {
  const deck = state.deck!;
  const hands: Record<string, ReturnType<typeof createBlackjackPlayerHand> & { cardIds: string[]; currentBet: number; actionStatus: 'acting' | 'stood' }> = {};
  seatCards.forEach((cards, index) => {
    const seat = index + 1;
    const boxId = boxPlayerId(state, seat);
    if (!boxId) {
      return;
    }
    const key = blackjackHandKey(boxId, 0);
    hands[key] = {
      ...createBlackjackPlayerHand(boxId, 0),
      cardIds: cards.map((rank) => findCardId(deck, rank)),
      currentBet: 20,
      actionStatus,
    };
  });
  return hands;
}

/** Box 1 only — dedicated N-card stack for containment capture. */
export function playingFullTableDesktopCardCountState(cardCount: 2 | 3 | 4): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const box1 = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, box1, 20);
  const deck = state.deck!;
  const cardSets: Record<2 | 3 | 4, [Rank, Rank] | [Rank, Rank, Rank] | [Rank, Rank, Rank, Rank]> = {
    2: ['K', '8'],
    3: ['K', '8', '3'],
    4: ['K', '8', '3', '2'],
  };
  const hands = buildHandsForSeats(state, [cardSets[cardCount]]);
  return withPlayingDesktopShell({
    ...state,
    selectedSeatId: box1,
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: blackjackHandKey(box1, 0),
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '8'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: hands,
    },
  });
}

/** All players stood — immediately before bank draw (hole still hidden). */
export function fullTableDesktopBeforeBankDrawState(): GameState {
  let state = tableAfterStartPlaying(500);
  for (let seat = 1; seat <= 2; seat += 1) {
    state = claimBoxSlot(state, seat);
    const boxId = boxPlayerId(state, seat)!;
    state = addChipToBoxStake(state, boxId, 20);
  }
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const hands = buildHandsForSeats(state, [['K', '8', '3'], ['Q', '7']]);
  return withPlayingDesktopShell({
    ...state,
    selectedSeatId: box1,
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: null,
      activePlayerId: null,
      dealerCardIds: [findCardId(deck, '8'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: hands,
    },
  });
}

/** Bank turn — same player stacks; dealer hole revealed and third card showing. */
export function fullTableDesktopAfterBankDrawState(): GameState {
  const before = fullTableDesktopBeforeBankDrawState();
  const deck = before.deck!;
  return {
    ...before,
    blackjack: {
      ...before.blackjack!,
      status: 'bank-turn',
      dealerCardIds: [
        findCardId(deck, '8'),
        findCardId(deck, 'K'),
        findCardId(deck, '5'),
      ],
      dealerHoleHidden: false,
    },
  };
}

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
  const hands = buildHandsForSeats(
    state,
    [
      ['K', '8', '3'],
      ['Q', '7'],
      ['K', '7'],
      ['8', '8'],
    ],
    'acting',
  );
  hands[k4]!.actionStatus = 'acting';
  return withPlayingDesktopShell({
    ...state,
    selectedSeatId: box4,
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: k4,
      activePlayerId: box4,
      dealerCardIds: [findCardId(deck, '8'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: hands,
    },
  });
}
