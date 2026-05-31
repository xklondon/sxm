import type { GameState } from '../../types';
import { getDealingStatusFromDeck } from '../../types/deck';
import type { Deck } from '../../types/deck';
import {
  createStandardDeck,
  drawCard,
  resetDeck,
  shuffleDeck,
} from './deck';
import {
  createBlackjackShoe,
  shuffleBlackjackShoe,
} from '../blackjack/shoe';

export function applyDeckToGameState(state: GameState, deck: Deck): GameState {
  return {
    ...state,
    deck,
    session: {
      ...state.session,
      deckId: deck.id,
      dealingStatus: getDealingStatusFromDeck(deck),
    },
  };
}

export function shuffleGameDeck(
  state: GameState,
  seed?: string | number,
): GameState {
  if (state.session.gameType === 'blackjack') {
    const shoe = createBlackjackShoe(state.blackjackSettings.numberOfDecks, state.deck?.id);
    return applyDeckToGameState(state, shuffleBlackjackShoe(shoe, seed));
  }

  const base = state.deck ?? createStandardDeck();
  return applyDeckToGameState(state, shuffleDeck(base, seed));
}

export function drawTestCard(state: GameState): GameState {
  if (!state.deck) {
    return state;
  }
  const { deck, card } = drawCard(state.deck);
  if (!card) {
    return applyDeckToGameState(state, deck);
  }
  return applyDeckToGameState(state, deck);
}

export function resetGameDeck(state: GameState): GameState {
  if (state.session.gameType === 'blackjack') {
    const shoe = createBlackjackShoe(state.blackjackSettings.numberOfDecks, state.deck?.id);
    return applyDeckToGameState(state, shoe);
  }
  const deck = resetDeck(state.deck ?? undefined);
  return applyDeckToGameState(state, deck);
}
