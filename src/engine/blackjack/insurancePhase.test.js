import { describe, expect, it } from 'vitest';
import { advanceInsurancePhaseIfComplete, takeInsuranceBet, } from './insurance';
import { getBlackjackProtocolPhase } from './protocol';
import { applyInsuranceAdvanceOnState, declineInsuranceOnState, takeInsuranceOnState, } from './gameState';
import { setBlackjackProtocolOnState } from './protocolState';
import { EUROPEAN_SHOE_PROTOCOL, LAS_VEGAS_PROTOCOL } from './protocols';
import { addChipToBoxStake, confirmBoxStake } from './stakes';
import { dealInitialBlackjackOnState } from './gameState';
import { bankrollContextFromState } from '../session/bankroll';
import { blackjackHandKey } from './handKeys';
import { createBlackjackPlayerHand, createEmptyBlackjackRound } from '../../types/blackjack';
import { getInsuranceActionsForController, getMyPendingInsurancePlayerIds, getPendingInsurancePlayerIds, showInsuranceControls, } from '../../components/blackjackViewPhase';
import { canDoubleBlackjackForState, canSplitBlackjackForState } from './validation';
import { actingRound, boxPlayerId, findCardId, tableWithClaimedBox } from './sanity/fixtures';
import { claimBoxSlot, setControllerName } from '../session/boxOps';
import { syncCallersForDeal } from '../session/playerAssignment';
function insuranceRound(state, boxId, cardIds, bet, overrides = {}) {
    const aceId = findCardId(state.deck, 'A');
    const holeId = findCardId(state.deck, '9');
    return {
        ...actingRound(state, boxId, cardIds, bet),
        status: 'player-turns',
        insuranceOfferPending: true,
        dealerCardIds: [aceId, holeId],
        dealerHoleHidden: true,
        activeHandKey: null,
        activePlayerId: null,
        ...overrides,
    };
}
describe('insurance phase', () => {
    it('shows insurance actions for caller person id when profile name differs from box controllerName', () => {
        let state = tableWithClaimedBox(1);
        state = setControllerName(state, 'Alice');
        const boxId = boxPlayerId(state, 1);
        const personId = state.tableMeta.ownerPersonId;
        state = addChipToBoxStake(state, boxId, 50, personId);
        state = confirmBoxStake(state, boxId);
        const round = insuranceRound(state, boxId, [findCardId(state.deck, '10'), findCardId(state.deck, '9')], 50);
        state = { ...state, blackjack: round };
        expect(getMyPendingInsurancePlayerIds(state, round, personId)).toEqual([boxId]);
        const actions = getInsuranceActionsForController(state, round, personId);
        expect(actions).toHaveLength(1);
        expect(actions[0]?.maxBet).toBe(25);
        expect(actions[0]?.canAfford).toBe(true);
    });
    it('take and decline advance when all eligible boxes decided', () => {
        let state = tableWithClaimedBox(1);
        const boxId = boxPlayerId(state, 1);
        const personId = state.tableMeta.ownerPersonId;
        state = addChipToBoxStake(state, boxId, 50, personId);
        state = confirmBoxStake(state, boxId);
        state = {
            ...state,
            blackjack: insuranceRound(state, boxId, [findCardId(state.deck, '10'), findCardId(state.deck, '9')], 50),
        };
        expect(getBlackjackProtocolPhase(state)).toBe('insurance');
        expect(showInsuranceControls('insurance', state.blackjack)).toBe(true);
        state = takeInsuranceOnState(state, boxId);
        expect(state.blackjack?.insuranceOfferPending).toBe(false);
        expect(state.blackjack?.insuranceBets?.[boxId]).toBe(25);
        let declineState = tableWithClaimedBox(1);
        const declineBoxId = boxPlayerId(declineState, 1);
        const declinePersonId = declineState.tableMeta.ownerPersonId;
        declineState = addChipToBoxStake(declineState, declineBoxId, 50, declinePersonId);
        declineState = confirmBoxStake(declineState, declineBoxId);
        declineState = {
            ...declineState,
            blackjack: insuranceRound(declineState, declineBoxId, [findCardId(declineState.deck, '10'), findCardId(declineState.deck, '8')], 50),
        };
        declineState = declineInsuranceOnState(declineState, declineBoxId);
        expect(declineState.blackjack?.insuranceOfferPending).toBe(false);
        expect(declineState.blackjack?.insuranceDeclined?.[declineBoxId]).toBe(true);
    });
    it('skips insurance phase when protocol disables insurance', () => {
        let state = tableWithClaimedBox(1);
        state = setBlackjackProtocolOnState(state, EUROPEAN_SHOE_PROTOCOL.protocolId, 'Alice');
        const boxId = boxPlayerId(state, 1);
        const personId = state.tableMeta.ownerPersonId;
        state = addChipToBoxStake(state, boxId, 50, personId);
        state = confirmBoxStake(state, boxId);
        state = dealInitialBlackjackOnState(state);
        expect(state.blackjack?.insuranceOfferPending).not.toBe(true);
        expect(getBlackjackProtocolPhase(state)).not.toBe('insurance');
    });
    it('auto-advances when no eligible insurance decisions remain', () => {
        let state = tableWithClaimedBox(1);
        const boxId = boxPlayerId(state, 1);
        const round = insuranceRound(state, boxId, [findCardId(state.deck, '10'), findCardId(state.deck, '9')], 50, { insuranceDeclined: { [boxId]: true }, insuranceBets: {} });
        state = { ...state, blackjack: round };
        const advanced = applyInsuranceAdvanceOnState(state);
        expect(advanced.blackjack?.insuranceOfferPending).toBe(false);
    });
    it('advanceInsurancePhaseIfComplete closes when pending list is empty', () => {
        const state = tableWithClaimedBox(1);
        const round = {
            ...createEmptyBlackjackRound(),
            status: 'player-turns',
            insuranceOfferPending: true,
            dealerHoleHidden: true,
            insuranceBets: {},
            insuranceDeclined: {},
        };
        const result = advanceInsurancePhaseIfComplete({ ...state, blackjack: round }, round, LAS_VEGAS_PROTOCOL);
        expect(result.closed).toBe(true);
        expect(result.round.insuranceOfferPending).toBe(false);
    });
    it('double and split respect protocol and bankroll on legal hands', () => {
        let state = tableWithClaimedBox(1);
        const boxId = boxPlayerId(state, 1);
        state = {
            ...state,
            blackjack: actingRound(state, boxId, [findCardId(state.deck, '5'), findCardId(state.deck, '6')], 25),
        };
        const handKey = `${boxId}:0`;
        expect(canDoubleBlackjackForState(state, handKey)).toBe(true);
        state = {
            ...state,
            blackjack: actingRound(state, boxId, [findCardId(state.deck, '8'), findCardId(state.deck, '8')], 25),
        };
        expect(canSplitBlackjackForState(state, handKey)).toBe(true);
    });
    it('takeInsuranceBet rejects when bankroll is insufficient', () => {
        let state = tableWithClaimedBox(1);
        const boxId = boxPlayerId(state, 1);
        const personId = state.tableMeta.ownerPersonId;
        state = addChipToBoxStake(state, boxId, 50, personId);
        state = confirmBoxStake(state, boxId);
        const round = insuranceRound(state, boxId, [findCardId(state.deck, '10'), findCardId(state.deck, '9')], 50);
        const brokeState = {
            ...state,
            ledger: { ...state.ledger, entries: [] },
        };
        expect(() => takeInsuranceBet(brokeState.session, brokeState.players, brokeState.ledger, round, boxId, bankrollContextFromState(brokeState), LAS_VEGAS_PROTOCOL)).toThrow(/not enough chips/i);
        const actions = getInsuranceActionsForController({ ...brokeState, blackjack: round }, round, personId);
        if (actions.length > 0) {
            expect(actions[0]?.canAfford).toBe(false);
        }
    });
    it('getPendingInsurancePlayerIds lists only unresolved eligible boxes', () => {
        let state = tableWithClaimedBox(1);
        state = claimBoxSlot(state, 2);
        const box1 = boxPlayerId(state, 1);
        const box2 = boxPlayerId(state, 2);
        const personId = state.tableMeta.ownerPersonId;
        state = addChipToBoxStake(state, box1, 50, personId);
        state = addChipToBoxStake(state, box2, 10, personId);
        state = confirmBoxStake(state, box1);
        state = confirmBoxStake(state, box2);
        state = syncCallersForDeal(state, [box1, box2]);
        const round = {
            ...createEmptyBlackjackRound(),
            status: 'player-turns',
            insuranceOfferPending: true,
            dealerCardIds: [findCardId(state.deck, 'A')],
            dealerHoleHidden: true,
            activeHandKey: null,
            insuranceDeclined: { [box1]: true },
            insuranceBets: {},
            playerHands: {
                [blackjackHandKey(box1, 0)]: {
                    ...createBlackjackPlayerHand(box1, 0),
                    cardIds: [findCardId(state.deck, '10'), findCardId(state.deck, '9')],
                    currentBet: 50,
                    actionStatus: 'acting',
                },
                [blackjackHandKey(box2, 0)]: {
                    ...createBlackjackPlayerHand(box2, 0),
                    cardIds: [findCardId(state.deck, '8'), findCardId(state.deck, '7')],
                    currentBet: 25,
                    actionStatus: 'acting',
                },
            },
        };
        expect(getPendingInsurancePlayerIds(state, round)).toEqual([box2]);
    });
});
