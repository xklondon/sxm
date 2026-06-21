import { describe, expect, it } from 'vitest';
import type { LedgerEntry } from '../../types/ledger';
import {
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
  tableWithClaimedBox,
} from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { completeBankingOnState, placeBlackjackBetOnState, startBlackjackRound } from './gameState';
import { evaluateBlackjackGameOver } from './gameOverEvaluation';
import { applyTableGameEndIfNeeded } from '../session/tableGameEnd';

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
});
