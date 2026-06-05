import { createNewBlackjackTable, confirmTableAgreement } from '../../session/table';
import { assignBankBot, claimBoxSlot, setControllerName } from '../../session/boxOps';
import { setTableOwner } from '../../session/invites';
import { ensureTableOwnerPersonBankroll } from '../../session/ownerBankroll';
import { createBlackjackShoe, shuffleBlackjackShoe } from '../shoe';
import { createBlackjackPlayerHand } from '../../../types/blackjack';
import { blackjackHandKey } from '../handKeys';
import { createInitialBlackjackRound } from '../helpers';
export function tableAfterStartPlaying(seatChips = 500, bankChips) {
    const bank = bankChips ?? seatChips;
    let state = createNewBlackjackTable();
    state = {
        ...state,
        tableMeta: {
            ...state.tableMeta,
            agreement: {
                stakeDescription: 'QA test',
                defaultChips: seatChips,
                agreedAt: new Date().toISOString(),
            },
            showStakeSetup: false,
            controllerName: 'Alice',
            startingChipsEachSeat: seatChips,
            startingChipsBank: bank,
            owner: { ownerName: 'Alice', ownerEmail: '', createdAt: new Date().toISOString() },
        },
        deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'qa-seed'),
    };
    state = confirmTableAgreement(state, 'QA test', seatChips, bank);
    state = setTableOwner(state, 'Alice', '');
    state = assignBankBot(state, bank);
    state = setControllerName(state, 'Alice');
    state = ensureTableOwnerPersonBankroll(state);
    return state;
}
export function baseTestTable() {
    return tableAfterStartPlaying(500);
}
export function tableWithClaimedBox(slotNumber = 1) {
    let state = baseTestTable();
    state = claimBoxSlot(state, slotNumber);
    return state;
}
export function tableWithTwoBoxesSamePerson() {
    let state = tableWithClaimedBox(1);
    state = claimBoxSlot(state, 2);
    return state;
}
export function boxPlayerId(state, slotNumber) {
    return state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber)?.playerId ?? null;
}
export function actingRound(state, boxId, cardIds, bet = 50) {
    const handKey = blackjackHandKey(boxId, 0);
    const base = state.blackjack ?? createInitialBlackjackRound(state.session);
    return {
        ...base,
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        playerHands: {
            ...base.playerHands,
            [handKey]: {
                ...createBlackjackPlayerHand(boxId, 0),
                cardIds,
                currentBet: bet,
                actionStatus: 'acting',
            },
        },
    };
}
export function findCardId(deck, rank, suit) {
    const card = deck.cards.find((c) => c.rank === rank && (!suit || c.suit === suit));
    if (!card) {
        throw new Error(`Card not found: ${rank}${suit ? ` ${suit}` : ''}`);
    }
    return card.id;
}
export function deckWithAceUp() {
    const deck = shuffleBlackjackShoe(createBlackjackShoe(1), 'insurance-test');
    const aceId = findCardId(deck, 'A');
    const idx = deck.cards.findIndex((c) => c.id === aceId);
    const drawOrder = [idx, ...deck.drawOrder.filter((i) => i !== idx)];
    return { ...deck, drawOrder };
}
export function deckWithTenUp() {
    const deck = shuffleBlackjackShoe(createBlackjackShoe(1), 'no-insurance-test');
    const tenId = findCardId(deck, '10');
    const idx = deck.cards.findIndex((c) => c.id === tenId);
    const drawOrder = [idx, ...deck.drawOrder.filter((i) => i !== idx)];
    return { ...deck, drawOrder };
}
