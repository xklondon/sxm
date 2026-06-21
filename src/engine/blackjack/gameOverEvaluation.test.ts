import { describe, expect, it } from 'vitest';
import type { LedgerEntry } from '../../types/ledger';
import {
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
  tableWithClaimedBox,
} from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { assignBankPerson } from '../session/boxOps';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { confirmTableAgreement, createNewBlackjackTable } from '../session/table';
import { setTableOwner } from '../session/invites';
import { ensureTableOwnerPersonBankroll } from '../session/ownerBankroll';
import { setControllerName } from '../session/boxOps';
import { addChipToBoxStake } from './stakes';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { completeBankingOnState, placeBlackjackBetOnState, startBlackjackRound } from './gameState';
import { evaluateBlackjackGameOver } from './gameOverEvaluation';
import { applyTableGameEndIfNeeded, evaluateTableGameEnd } from '../session/tableGameEnd';
import { getLedgerBalanceForBankrollOwner } from '../session/bankroll';

function ownerAsBankPlayingTable(seatChips = 500) {
  let state = createNewBlackjackTable();
  state = confirmTableAgreement(state, 'Challenge', seatChips, seatChips);
  state = setTableOwner(state, 'Alice', '');
  state = setControllerName(state, 'Alice');
  state = assignBankPerson(state, 'Alice', seatChips);
  state = ensureTableOwnerPersonBankroll(state);
  const bankId = state.session.bankPlayerId!;
  const ownerId = state.tableMeta.ownerPersonId!;
  return { state, bankId, ownerId };
}

function addGuestPlayer(state: ReturnType<typeof ownerAsBankPlayingTable>['state'], chips: number) {
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'Bob',
    controllerName: 'Bob',
    role: 'person',
    startingChips: 0,
  });
  const next = mergeSessionUpdate(state, guestSpl);
  const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  return {
    state: allocateChipsToBankrollOwner(next, {
      bankrollOwnerId: guestId,
      amount: chips,
      reason: 'initial-player',
      source: 'setup',
    }),
    guestId,
  };
}

function drainGuestLedger(
  state: ReturnType<typeof ownerAsBankPlayingTable>['state'],
  guestId: string,
): ReturnType<typeof ownerAsBankPlayingTable>['state'] {
  const balance = derivePlayerBalanceFromLedger(guestId, state.ledger);
  if (balance <= 0) {
    return state;
  }
  const entry: LedgerEntry = {
    id: `drain-${guestId}-${state.ledger.entries.length}`,
    timestamp: new Date().toISOString(),
    roundNumber: state.session.currentRound,
    playerId: guestId,
    entryType: 'loss-collected',
    amount: -balance,
    balanceBefore: balance,
    balanceAfter: 0,
    description: 'test drain',
  };
  return {
    ...state,
    ledger: { ...state.ledger, entries: [...state.ledger.entries, entry] },
  };
}

describe('evaluateBlackjackGameOver', () => {
  it('returns false while bank and at least one player still hold chips', () => {
    const state = tableAfterStartPlaying(500);
    const result = evaluateBlackjackGameOver(state);
    expect(result.isGameOver).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('detects bank bankruptcy after settlement ledger updates', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    state = startBlackjackRound(state);
    state = placeBlackjackBetOnState(state, boxId, 500);
    state = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        status: 'banking',
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '8')],
        dealerHoleHidden: false,
        playerHands: {
          [`${boxId}:0`]: {
            ...state.blackjack!.playerHands[`${boxId}:0`]!,
            cardIds: [findCardId(deck, 'K'), findCardId(deck, '9')],
            currentBet: 500,
            actionStatus: 'stood',
          },
        },
      },
    };
    state = completeBankingOnState(state);
    const result = evaluateBlackjackGameOver(state);
    expect(state.tableMeta.gameStatus).toBe('ended');
    expect(result.isGameOver).toBe(true);
    expect(result.reason).toBe('bank-broke');
    expect(result.winnerSide).toBe('players');
    expect(result.message.length).toBeGreaterThan(0);
    expect(Object.keys(state.blackjack?.playerHands ?? {}).length).toBeGreaterThan(0);
  });

  it('detects all players broke after settlement', () => {
    let state = tableWithClaimedBox(1);
    const bankId = state.session.bankPlayerId!;
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    state = startBlackjackRound(state);
    state = placeBlackjackBetOnState(state, boxId, 500);
    state = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        status: 'banking',
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
        dealerHoleHidden: false,
        playerHands: {
          [`${boxId}:0`]: {
            ...state.blackjack!.playerHands[`${boxId}:0`]!,
            cardIds: [findCardId(deck, '10'), findCardId(deck, '8')],
            currentBet: 500,
            actionStatus: 'stood',
          },
        },
      },
    };
    state = completeBankingOnState(state);
    const result = evaluateBlackjackGameOver(state);
    expect(result.isGameOver).toBe(true);
    expect(result.reason).toBe('single-holder');
    expect(result.winnerPersonId).toBe(bankId);
    expect(state.tableMeta.awaitingNextRound).toBe(false);
  });

  it('does not trigger game over from pre-settlement ledger snapshot', () => {
    const state = tableAfterStartPlaying(500);
    const bankId = state.session.bankPlayerId!;
    const entry: LedgerEntry = {
      id: 'would-end-if-applied',
      timestamp: new Date().toISOString(),
      roundNumber: state.session.currentRound,
      playerId: bankId,
      entryType: 'loss-collected',
      amount: -500,
      balanceBefore: 500,
      balanceAfter: 0,
      description: 'test only',
    };
    const preview = applyTableGameEndIfNeeded({
      ...state,
      ledger: { ...state.ledger, entries: [...state.ledger.entries, entry] },
    });
    expect(evaluateBlackjackGameOver(preview).isGameOver).toBe(true);
    expect(evaluateBlackjackGameOver(state).isGameOver).toBe(false);
  });

  describe('bank-owner exclusion from non-bank liveness', () => {
    it('ends when bank owner box still has chips but all invited players are broke', () => {
      let { state, bankId, ownerId } = ownerAsBankPlayingTable();
      const guest = addGuestPlayer(state, 500);
      state = guest.state;
      state = drainGuestLedger(state, guest.guestId);
      state = claimBoxSlot(state, 1);
      const box1 = boxPlayerId(state, 1)!;
      state = addChipToBoxStake(state, box1, 100, ownerId);

      expect(getLedgerBalanceForBankrollOwner(state, bankId)).toBeGreaterThan(0);
      expect(getLedgerBalanceForBankrollOwner(state, guest.guestId)).toBe(0);

      const result = evaluateTableGameEnd(state);
      expect(result.ended).toBe(true);
      expect(result.reason).toBe('all-players-eliminated');
      expect(evaluateBlackjackGameOver(state).isGameOver).toBe(true);
    });

    it('does not end when another invited player still holds chips', () => {
      let { state } = ownerAsBankPlayingTable();
      const guest = addGuestPlayer(state, 500);
      state = guest.state;
      state = claimBoxSlot(state, 1);
      const box1 = boxPlayerId(state, 1)!;
      state = addChipToBoxStake(state, box1, 100, state.tableMeta.ownerPersonId!);

      const result = evaluateTableGameEnd(state);
      expect(result.ended).toBe(false);
      expect(evaluateBlackjackGameOver(state).isGameOver).toBe(false);
    });

    it('ends when bank balance is zero regardless of bank-owner box', () => {
      let { state, bankId, ownerId } = ownerAsBankPlayingTable();
      state = claimBoxSlot(state, 1);
      const box1 = boxPlayerId(state, 1)!;
      state = addChipToBoxStake(state, box1, 100, ownerId);
      const bankBalance = derivePlayerBalanceFromLedger(bankId, state.ledger);
      const entry: LedgerEntry = {
        id: 'bank-bust-test',
        timestamp: new Date().toISOString(),
        roundNumber: state.session.currentRound,
        playerId: bankId,
        entryType: 'loss-collected',
        amount: -bankBalance,
        balanceBefore: bankBalance,
        balanceAfter: 0,
        description: 'test bank bust',
      };
      state = {
        ...state,
        ledger: { ...state.ledger, entries: [...state.ledger.entries, entry] },
      };

      const result = evaluateTableGameEnd(state);
      expect(result.ended).toBe(true);
      expect(result.reason).toBe('bank-bust');
    });

    it('still works with practice bot bank', () => {
      let state = tableAfterStartPlaying(500);
      state = claimBoxSlot(state, 1);
      const boxId = boxPlayerId(state, 1)!;
      const bankId = state.session.bankPlayerId!;
      const balance = derivePlayerBalanceFromLedger(bankId, state.ledger);
      const entry: LedgerEntry = {
        id: 'bot-bank-bust',
        timestamp: new Date().toISOString(),
        roundNumber: state.session.currentRound,
        playerId: bankId,
        entryType: 'loss-collected',
        amount: -balance,
        balanceBefore: balance,
        balanceAfter: 0,
        description: 'test bot bank bust',
      };
      state = {
        ...state,
        ledger: { ...state.ledger, entries: [...state.ledger.entries, entry] },
      };

      expect(evaluateTableGameEnd(state).ended).toBe(true);
      expect(evaluateBlackjackGameOver(state).reason).toBe('bank-broke');
      expect(boxId).toBeTruthy();
    });

    it('excludes every box owned by the bank owner from liveness', () => {
      let { state, ownerId } = ownerAsBankPlayingTable();
      const guest = addGuestPlayer(state, 500);
      state = drainGuestLedger(guest.state, guest.guestId);
      state = claimBoxSlot(state, 1);
      state = claimBoxSlot(state, 2);
      const box1 = boxPlayerId(state, 1)!;
      const box2 = boxPlayerId(state, 2)!;
      state = addChipToBoxStake(state, box1, 50, ownerId);
      state = addChipToBoxStake(state, box2, 50, ownerId);

      expect(evaluateTableGameEnd(state).ended).toBe(true);
    });

    it('counts invited player boxes toward liveness', () => {
      let { state } = ownerAsBankPlayingTable();
      const guest = addGuestPlayer(state, 500);
      state = guest.state;
      state = claimBoxSlot(state, 2);
      const guestBox = boxPlayerId(state, 2)!;
      state = {
        ...state,
        tableMeta: {
          ...state.tableMeta,
          boxSlots: state.tableMeta.boxSlots.map((slot) =>
            slot.slotNumber === 2
              ? { ...slot, playerId: guestBox, bankrollOwnerId: guest.guestId, controllerName: 'Bob' }
              : slot,
          ),
        },
      };

      expect(evaluateTableGameEnd(state).ended).toBe(false);
    });
  });
});
