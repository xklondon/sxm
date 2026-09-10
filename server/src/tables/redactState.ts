import type { GameState } from '../../../src/types/index.js';
import type { Deck } from '../../../src/types/deck.js';
import { getBlackjackProtocolForState } from '../../../src/engine/blackjack/protocolState.js';
import { canPersonControlHoldemSeat } from '../../../src/engine/holdem/holdemTurnAuthority.js';

/**
 * Transport-boundary redaction: strip information a viewer must not have from
 * a GameState before it leaves the server (socket broadcast or HTTP response).
 *
 * Rules mirror the client's own visibility logic exactly — the server must
 * never hide a card the client would render face-up:
 * - Dealer hole card: `getVisibleDealerCardIds` reveal condition
 *   (src/engine/blackjack/protocolState.ts) — hidden unless the protocol shows
 *   it during play, the round reached bank-turn/banking/resolved, or
 *   `dealerHoleHidden` is false.
 * - Hold'em hole cards: `mapPokerTableViewModel` face-up condition
 *   (isViewer || showdown || resolved), with seat ownership resolved through
 *   `canPersonControlHoldemSeat` (same authority the action layer uses).
 * - Deck order: `drawOrder` is the entire secret of the shoe; clients only
 *   ever use its length (counts / dealing status), so it is replaced with a
 *   sequential dummy of the same length.
 *
 * Hidden card ids are swapped for decoy ids of REAL cards from the deck
 * (deck.cards is the canonical, public enumeration) so client-side
 * `getCardById` lookups still resolve and card counts/keys stay stable while
 * the cards render face-down.
 */
export function redactStateForViewer(
  state: GameState,
  viewerPersonId: string | null,
): GameState {
  const swaps = new Map<string, string>();
  let next = state;
  next = redactBlackjackHole(next, swaps);
  next = redactHoldemHoles(next, viewerPersonId, swaps);
  next = redactDeck(next, swaps);
  return next;
}

function decoyCardId(deck: Deck, index: number): string | null {
  return deck.cards[index % deck.cards.length]?.id ?? null;
}

/** Mirror of getVisibleDealerCardIds' reveal condition (protocolState.ts). */
function isBlackjackHoleHidden(state: GameState): boolean {
  const round = state.blackjack;
  if (!round) {
    return false;
  }
  const ids = round.dealerCardIds.filter(Boolean);
  if (ids.length < 2) {
    return false;
  }
  const protocol = getBlackjackProtocolForState(state);
  if (protocol.dealingRules.showDealerHoleCardDuringPlay) {
    return false;
  }
  const revealSecondFaceUp =
    round.status === 'bank-turn' ||
    round.status === 'banking' ||
    round.status === 'resolved' ||
    !round.dealerHoleHidden;
  return !revealSecondFaceUp;
}

function redactBlackjackHole(state: GameState, swaps: Map<string, string>): GameState {
  if (!state.deck || !isBlackjackHoleHidden(state)) {
    return state;
  }
  const round = state.blackjack!;
  const holeId = round.dealerCardIds[1];
  if (!holeId) {
    return state;
  }
  const decoy = decoyCardId(state.deck, 0);
  if (!decoy) {
    return state;
  }
  swaps.set(holeId, decoy);
  const dealerCardIds = [...round.dealerCardIds];
  dealerCardIds[1] = decoy;
  return {
    ...state,
    blackjack: { ...round, dealerCardIds },
  };
}

function redactHoldemHoles(
  state: GameState,
  viewerPersonId: string | null,
  swaps: Map<string, string>,
): GameState {
  const holdem = state.holdem;
  if (!holdem || !state.deck || state.deck.cards.length === 0) {
    return state;
  }
  // Client shows every seat face-up at showdown/resolved.
  if (holdem.status === 'showdown' || holdem.status === 'resolved') {
    return state;
  }
  let changed = false;
  const playerStates = { ...holdem.playerStates };
  for (const [seatId, seatState] of Object.entries(holdem.playerStates)) {
    if (!seatState.holeCardIds.length) {
      continue;
    }
    if (viewerPersonId && canPersonControlHoldemSeat(state, viewerPersonId, seatId)) {
      continue;
    }
    const holeCardIds = seatState.holeCardIds.map((realId, index) => {
      const decoy = decoyCardId(state.deck!, index);
      if (!decoy) {
        return realId;
      }
      swaps.set(realId, decoy);
      return decoy;
    });
    playerStates[seatId] = { ...seatState, holeCardIds };
    changed = true;
  }
  if (!changed) {
    return state;
  }
  return {
    ...state,
    holdem: { ...holdem, playerStates },
  };
}

function redactDeck(state: GameState, swaps: Map<string, string>): GameState {
  const deck = state.deck;
  if (!deck || (deck.drawOrder.length === 0 && swaps.size === 0)) {
    return state;
  }
  const dealtCardIds = swaps.size
    ? deck.dealtCardIds.map((id) => swaps.get(id) ?? id)
    : deck.dealtCardIds;
  return {
    ...state,
    deck: {
      ...deck,
      // Length is all clients use (remaining count / dealing status); the
      // real order — and via set-complement, any hidden card — stays server-side.
      drawOrder: deck.drawOrder.map((_, index) => index),
      dealtCardIds,
    },
  };
}
