import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { syncPlayerOrderAndAssignments } from '../session/playerAssignment';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { addChipToBoxStake } from './stakes';
import { doubleDownBlackjackOnState } from './gameState';
import { canDoubleBlackjackForState } from './validation';
import { boxPlayerId, findCardId, tableAfterStartPlaying, actingRound } from './sanity/fixtures';
import { blackjackHandKey } from './handKeys';

function twoPlayerSeated(startingChips = 500) {
  let state = tableAfterStartPlaying(startingChips);
  const host = state.tableMeta.ownerPersonId!;
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'K',
    controllerName: 'K',
    role: 'person',
    startingChips: 0,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const guest = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: guest,
    amount: startingChips,
    reason: 'initial-player',
    source: 'setup',
  });
  state = {
    ...state,
    tableMeta: { ...state.tableMeta, playerOrder: [host, guest] },
  };
  state = syncPlayerOrderAndAssignments(state);
  return { state, host, guest };
}

function ledgerBalance(state: GameState, personId: string): number {
  return derivePlayerBalanceFromLedger(personId, state.ledger);
}

function playerTurnHard9(state: GameState, boxId: string, bet = 50) {
  const deck = state.deck!;
  const handKey = blackjackHandKey(boxId, 0);
  const round = actingRound(state, boxId, [findCardId(deck, '5'), findCardId(deck, '4')], bet);
  return {
    handKey,
    state: {
      ...state,
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjack: {
        ...round,
        status: 'player-turns' as const,
        activeHandKey: handKey,
        activePlayerId: boxId,
      },
    },
  };
}

describe('double payer funding', () => {
  it('hard 9 offers Double when rules allow', () => {
    const { state } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const { state: playing, handKey } = playerTurnHard9(state, box1);
    expect(canDoubleBlackjackForState(playing, handKey)).toBe(true);
  });

  it('guest k on host box: k funds double, not host', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    const { state: basePlaying, handKey } = playerTurnHard9(ready, box1, 100);
    const playing = {
      ...basePlaying,
      blackjack: {
        ...basePlaying.blackjack!,
        playerHands: {
          ...basePlaying.blackjack!.playerHands,
          [handKey]: {
            ...basePlaying.blackjack!.playerHands[handKey]!,
            stakerAmountsByPersonId: { [guest]: 100 },
          },
        },
      },
    };
    const hostBefore = ledgerBalance(playing, host);
    const guestBefore = ledgerBalance(playing, guest);
    const doubled = doubleDownBlackjackOnState(playing, handKey);
    expect(ledgerBalance(doubled, guest)).toBe(guestBefore - 100);
    expect(ledgerBalance(doubled, host)).toBe(hostBefore);
  });
});
