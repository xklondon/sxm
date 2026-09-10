import { describe, expect, it } from 'vitest';
import { redactStateForViewer } from '../src/tables/redactState.js';
import { createNewBlackjackTable } from '../../src/engine/session/index.js';
import { createBlackjackShoe, shuffleBlackjackShoe } from '../../src/engine/blackjack/shoe.js';
import { getCardById } from '../../src/engine/deck/index.js';
import type { GameState } from '../../src/types/index.js';
import type { BlackjackRound } from '../../src/types/index.js';

function blackjackFixture(status: BlackjackRound['status'], protocolId: string): {
  state: GameState;
  upcardId: string;
  holeId: string;
} {
  const base = createNewBlackjackTable();
  const deck = shuffleBlackjackShoe(createBlackjackShoe(2), 'redaction-test');
  const upcardId = deck.cards[10]!.id;
  const holeId = deck.cards[20]!.id;
  const dealt = {
    ...deck,
    drawOrder: deck.drawOrder.filter(
      (index) => deck.cards[index]!.id !== upcardId && deck.cards[index]!.id !== holeId,
    ),
    dealtCardIds: [upcardId, holeId],
  };
  const state: GameState = {
    ...base,
    blackjackProtocolId: protocolId,
    deck: dealt,
    blackjack: {
      status,
      activeHandKey: null,
      playerHands: {},
      dealerCardIds: [upcardId, holeId],
      dealerHoleHidden: true,
      insuranceOffered: false,
      evenMoneyOfferHandKey: null,
      bankDrawMode: 'auto',
      initialDealMode: 'auto',
    } as unknown as GameState['blackjack'],
  };
  return { state, upcardId, holeId };
}

describe('redactStateForViewer — blackjack', () => {
  it('hides the dealer hole card while play is running (hole-hidden protocol)', () => {
    const { state, upcardId, holeId } = blackjackFixture('player-turns', 'european-shoe');
    const redacted = redactStateForViewer(state, 'viewer-person');

    expect(redacted.blackjack!.dealerCardIds[0]).toBe(upcardId);
    expect(redacted.blackjack!.dealerCardIds[1]).not.toBe(holeId);
    // Decoy must resolve to a real card so the client renders a face-down card.
    expect(getCardById(redacted.deck!, redacted.blackjack!.dealerCardIds[1]!)).toBeTruthy();
    // The real hole id must not be recoverable from the dealt list either.
    expect(redacted.deck!.dealtCardIds).not.toContain(holeId);
    expect(redacted.deck!.dealtCardIds).toHaveLength(state.deck!.dealtCardIds.length);
  });

  it('reveals the real hole card once the round reaches bank-turn', () => {
    const { state, holeId } = blackjackFixture('bank-turn', 'european-shoe');
    const redacted = redactStateForViewer(state, 'viewer-person');
    expect(redacted.blackjack!.dealerCardIds[1]).toBe(holeId);
    expect(redacted.deck!.dealtCardIds).toContain(holeId);
  });

  it('does not hide the hole card for protocols that show it during play', () => {
    const { state, holeId } = blackjackFixture('player-turns', 'las-vegas-house');
    const redacted = redactStateForViewer(state, 'viewer-person');
    expect(redacted.blackjack!.dealerCardIds[1]).toBe(holeId);
  });

  it('masks the shoe order but preserves counts', () => {
    const { state } = blackjackFixture('player-turns', 'european-shoe');
    const redacted = redactStateForViewer(state, 'viewer-person');
    expect(redacted.deck!.drawOrder).toHaveLength(state.deck!.drawOrder.length);
    expect(redacted.deck!.drawOrder).toEqual(
      state.deck!.drawOrder.map((_, index) => index),
    );
    expect(redacted.deck!.cards).toEqual(state.deck!.cards);
  });
});

describe('redactStateForViewer — holdem', () => {
  function holdemFixture(status: string): { state: GameState; seatA: string; seatB: string } {
    const base = createNewBlackjackTable();
    const deck = shuffleBlackjackShoe(createBlackjackShoe(1), 'holdem-redaction');
    const seatA = 'person-a';
    const seatB = 'person-b';
    const holesA = [deck.cards[5]!.id, deck.cards[6]!.id];
    const holesB = [deck.cards[7]!.id, deck.cards[8]!.id];
    const state: GameState = {
      ...base,
      tableGame: 'texas-holdem',
      session: { ...base.session, playerIds: [...base.session.playerIds, seatA, seatB] },
      deck: { ...deck, dealtCardIds: [...holesA, ...holesB] },
      players: {
        ...base.players,
        [seatA]: {
          id: seatA,
          displayName: 'A',
          role: 'person',
          playerType: 'real',
        } as unknown as GameState['players'][string],
        [seatB]: {
          id: seatB,
          displayName: 'B',
          role: 'person',
          playerType: 'real',
        } as unknown as GameState['players'][string],
      },
      holdem: {
        status,
        bettingStreet: 'preflop',
        smallBlind: 5,
        bigBlind: 10,
        communityCardIds: [],
        pot: 0,
        currentBet: 10,
        dealerButtonPlayerId: seatA,
        smallBlindPlayerId: seatA,
        bigBlindPlayerId: seatB,
        activePlayerId: seatA,
        playerStates: {
          [seatA]: {
            holeCardIds: holesA,
            actionStatus: 'active',
            playerBetsThisStreet: 0,
            playerTotalCommitted: 0,
            hasActedThisStreet: false,
          },
          [seatB]: {
            holeCardIds: holesB,
            actionStatus: 'waiting',
            playerBetsThisStreet: 10,
            playerTotalCommitted: 10,
            hasActedThisStreet: false,
          },
        },
        actionLog: [],
        winners: [],
        resultSummary: '',
        lastRaiseSize: 10,
      } as unknown as GameState['holdem'],
    };
    return { state, seatA, seatB };
  }

  it('keeps own hole cards, decoys opponents mid-hand', () => {
    const { state, seatA, seatB } = holdemFixture('preflop');
    const redacted = redactStateForViewer(state, seatA);
    const own = redacted.holdem!.playerStates[seatA]!.holeCardIds;
    const opp = redacted.holdem!.playerStates[seatB]!.holeCardIds;

    expect(own).toEqual(state.holdem!.playerStates[seatA]!.holeCardIds);
    expect(opp).not.toEqual(state.holdem!.playerStates[seatB]!.holeCardIds);
    expect(opp).toHaveLength(2);
    expect(new Set(opp).size).toBe(2); // distinct decoys (React keys per seat)
    for (const id of opp) {
      expect(getCardById(redacted.deck!, id)).toBeTruthy();
    }
    // Real opponent ids not recoverable from the dealt list.
    for (const realId of state.holdem!.playerStates[seatB]!.holeCardIds) {
      expect(redacted.deck!.dealtCardIds).not.toContain(realId);
    }
  });

  it('reveals every seat at showdown', () => {
    const { state, seatA, seatB } = holdemFixture('showdown');
    const redacted = redactStateForViewer(state, seatA);
    expect(redacted.holdem!.playerStates[seatB]!.holeCardIds).toEqual(
      state.holdem!.playerStates[seatB]!.holeCardIds,
    );
  });

  it('redacts all seats for a null viewer', () => {
    const { state, seatA, seatB } = holdemFixture('preflop');
    const redacted = redactStateForViewer(state, null);
    expect(redacted.holdem!.playerStates[seatA]!.holeCardIds).not.toEqual(
      state.holdem!.playerStates[seatA]!.holeCardIds,
    );
    expect(redacted.holdem!.playerStates[seatB]!.holeCardIds).not.toEqual(
      state.holdem!.playerStates[seatB]!.holeCardIds,
    );
  });
});
