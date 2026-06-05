import { describe, expect, it } from 'vitest';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import { tableAfterStartPlaying, tableWithClaimedBox, boxPlayerId, findCardId, actingRound, } from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { blackjackHandKey } from './handKeys';
import { settleBustHandOnState, BUST_MESSAGE } from './bustSettlement';
import { buildRoundResultSummary } from './roundResultSummary';
import { evaluateTableGameEnd, applyTableGameEndIfNeeded, isTableGameActive, getGameOverMessage, } from '../session/tableGameEnd';
import { isBotBankGame, canAddGameToPersonalLedger, addGameToPersonalLedger, } from '../scoreLedger/scoreLedger';
describe('bust presentation — cards stay visible', () => {
    it('settleBustHandOnState keeps the busted cards and marks the loss', () => {
        let state = tableWithClaimedBox(1);
        const deck = state.deck;
        const box = boxPlayerId(state, 1);
        const handKey = blackjackHandKey(box, 0);
        const cards = [findCardId(deck, '10'), findCardId(deck, '9'), findCardId(deck, '5')];
        const round = actingRound(state, box, cards, 10);
        round.playerHands[handKey].actionStatus = 'busted';
        state = { ...state, blackjack: round };
        const settled = settleBustHandOnState(state, handKey);
        const hand = settled.blackjack.playerHands[handKey];
        expect(hand.cardIds).toEqual(cards); // not retracted
        expect(hand.bustSettled).toBe(true);
        expect(settled.blackjack.resultMessages[handKey]).toBe(BUST_MESSAGE);
        expect(settled.blackjack.outcomes[handKey]).toBe('loss');
    });
});
describe('round result summary — one line per resolved box + bank header', () => {
    function settledThreeBoxTable() {
        let state = tableAfterStartPlaying(500);
        state = claimBoxSlot(state, 1);
        state = claimBoxSlot(state, 3);
        state = claimBoxSlot(state, 4);
        const deck = state.deck;
        const box1 = boxPlayerId(state, 1);
        const box3 = boxPlayerId(state, 3);
        const box4 = boxPlayerId(state, 4);
        const k1 = blackjackHandKey(box1, 0);
        const k3 = blackjackHandKey(box3, 0);
        const k4 = blackjackHandKey(box4, 0);
        const round = {
            ...state.blackjack,
            status: 'resolved',
            isSettled: true,
            dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')], // Bank 19
            playerHands: {
                [k1]: { ...createBlackjackPlayerHand(box1, 0), cardIds: [findCardId(deck, '10'), findCardId(deck, '8')], currentBet: 5 },
                [k3]: { ...createBlackjackPlayerHand(box3, 0), cardIds: [findCardId(deck, 'K'), findCardId(deck, 'Q')], currentBet: 5 },
                [k4]: { ...createBlackjackPlayerHand(box4, 0), cardIds: [findCardId(deck, '7'), findCardId(deck, 'A')], currentBet: 10 },
            },
            outcomes: { [k1]: 'loss', [k3]: 'loss', [k4]: 'win' },
            resultMessages: {},
        };
        return { ...state, blackjack: round };
    }
    it('produces a bank header and a line for every resolved box', () => {
        const state = settledThreeBoxTable();
        const lines = buildRoundResultSummary(state);
        expect(lines).toHaveLength(4); // bank + 3 boxes
        expect(lines[0]).toBe('Bank 19.');
        expect(lines.some((l) => /loses — bank wins 5\./.test(l))).toBe(true);
        expect(lines.some((l) => /wins —/.test(l))).toBe(true);
    });
});
describe('bank bankruptcy ends the game', () => {
    function bankBustState() {
        const state = tableAfterStartPlaying(500);
        const bankId = state.session.bankPlayerId;
        const entry = {
            id: 'test-bank-bust',
            timestamp: new Date().toISOString(),
            roundNumber: state.session.currentRound,
            playerId: bankId,
            entryType: 'loss-collected',
            amount: -500,
            balanceBefore: 500,
            balanceAfter: 0,
            description: 'test: bank wiped out',
        };
        return { ...state, ledger: { ...state.ledger, entries: [...state.ledger.entries, entry] } };
    }
    it('flags bank-bust and stops further dealing with a clear message', () => {
        const state = bankBustState();
        const evaluation = evaluateTableGameEnd(state);
        expect(evaluation.ended).toBe(true);
        expect(evaluation.reason).toBe('bank-bust');
        const ended = applyTableGameEndIfNeeded(state);
        expect(ended.tableMeta.gameStatus).toBe('ended');
        expect(isTableGameActive(ended)).toBe(false); // no further dealing
        expect(getGameOverMessage(ended)).toContain('Bank is bust');
    });
});
describe('personal ledger eligibility — human-vs-human only', () => {
    it('hides personal ledger for Bot Bank games', () => {
        const botState = tableAfterStartPlaying(500);
        expect(isBotBankGame(botState)).toBe(true);
        const ended = {
            ...botState,
            tableMeta: { ...botState.tableMeta, gameStatus: 'ended' },
        };
        expect(canAddGameToPersonalLedger(ended)).toBe(false);
        expect(addGameToPersonalLedger(ended)).toBeNull();
    });
    it('shows personal ledger for human-vs-human games', () => {
        const botState = tableAfterStartPlaying(500);
        const bankId = botState.session.bankPlayerId;
        const humanBank = {
            ...botState,
            players: {
                ...botState.players,
                [bankId]: { ...botState.players[bankId], playerType: 'real' },
            },
        };
        expect(isBotBankGame(humanBank)).toBe(false);
        const ended = {
            ...humanBank,
            tableMeta: { ...humanBank.tableMeta, gameStatus: 'ended' },
        };
        expect(canAddGameToPersonalLedger(ended)).toBe(true);
    });
});
