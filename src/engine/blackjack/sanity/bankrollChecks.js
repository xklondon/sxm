import { derivePlayerBalanceFromLedger } from '../../ledger/ledger';
import { findPersonPlayerIdByController, getAvailableChipsForBankrollOwner, getLedgerBalanceForBankrollOwner, resolveBankrollOwnerIdForBox, } from '../../session/bankroll';
import { placeBlackjackBetOnState, startBlackjackRound, completeBankingOnState } from '../gameState';
import { check } from './types';
import { boxPlayerId, findCardId, tableWithClaimedBox, tableWithTwoBoxesSamePerson, } from './fixtures';
export function runBankrollSanityChecks() {
    const results = [];
    let state = tableWithTwoBoxesSamePerson();
    const personId = findPersonPlayerIdByController(state, 'Alice');
    results.push(check('person record exists after claiming boxes', Boolean(personId)));
    if (personId) {
        const balAfterTwo = getLedgerBalanceForBankrollOwner(state, personId);
        results.push(check('multi-box claim: single buy-in (500 chips once)', balAfterTwo === 500, `balance=${balAfterTwo}`));
        const box1 = boxPlayerId(state, 1);
        const box2 = boxPlayerId(state, 2);
        results.push(check('both boxes share same bankroll owner', Boolean(box1 && box2) &&
            resolveBankrollOwnerIdForBox(state, box1) === personId &&
            resolveBankrollOwnerIdForBox(state, box2) === personId));
    }
    state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1);
    const ownerId = boxId ? resolveBankrollOwnerIdForBox(state, boxId) : null;
    if (boxId && ownerId) {
        const before = getLedgerBalanceForBankrollOwner(state, ownerId);
        state = placeBlackjackBetOnState(state, boxId, 100);
        const after = getLedgerBalanceForBankrollOwner(state, ownerId);
        results.push(check('bet reduces player bankroll', before - after === 100, `before=${before} after=${after}`));
        results.push(check('available chips reflect open bet (ledger minus in-round exposure)', getAvailableChipsForBankrollOwner(state, ownerId) === after - 100, `available=${getAvailableChipsForBankrollOwner(state, ownerId)} ledger=${after}`));
    }
    state = tableWithClaimedBox(1);
    const bId = boxPlayerId(state, 1);
    const oId = resolveBankrollOwnerIdForBox(state, bId);
    state = startBlackjackRound(state);
    state = placeBlackjackBetOnState(state, bId, 50);
    const d = state.deck;
    state = {
        ...state,
        blackjack: {
            ...state.blackjack,
            status: 'banking',
            dealerCardIds: [findCardId(d, '10'), findCardId(d, '8')],
            playerHands: {
                ...state.blackjack.playerHands,
                [`${bId}:0`]: {
                    ...state.blackjack.playerHands[`${bId}:0`],
                    cardIds: [findCardId(d, 'K'), findCardId(d, '9')],
                    actionStatus: 'stood',
                },
            },
        },
    };
    const playerBalBeforeWin = getLedgerBalanceForBankrollOwner(state, oId);
    state = completeBankingOnState(state);
    const playerBalAfterWin = getLedgerBalanceForBankrollOwner(state, oId);
    results.push(check('win pays stake + winnings to player bankroll', playerBalAfterWin - playerBalBeforeWin === 100, `delta=${playerBalAfterWin - playerBalBeforeWin}`));
    if (state.session.bankPlayerId) {
        const bankBal = derivePlayerBalanceFromLedger(state.session.bankPlayerId, state.ledger);
        results.push(check('bank bankroll tracked in ledger', typeof bankBal === 'number' && bankBal >= 0, `bankBalance=${bankBal}`));
    }
    return { passed: results.every((r) => r.passed), results };
}
