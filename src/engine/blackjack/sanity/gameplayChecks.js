import { bankrollContextFromState } from '../../session/bankroll';
import { doubleDownBlackjackPlayer, resolveBlackjackRound, splitBlackjackPlayer, } from '../round';
import { shouldOfferInsurance, dealerShowsAce } from '../insurance';
import { protocolToBlackjackSettings, LAS_VEGAS_PROTOCOL, EUROPEAN_SHOE_PROTOCOL, CLASSIC_HOME_PROTOCOL, } from '../protocols';
import { listHandKeysForPlayer } from '../handKeys';
import { check } from './types';
import { actingRound, boxPlayerId, deckWithAceUp, deckWithTenUp, findCardId, tableWithClaimedBox, } from './fixtures';
import { placeBlackjackBetOnState, startBlackjackRound } from '../gameState';
export function runGameplaySanityChecks() {
    const results = [];
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1);
    const deck = state.deck;
    state = startBlackjackRound(state);
    state = placeBlackjackBetOnState(state, boxId, 40);
    const eightId = findCardId(deck, '8', 'spades');
    const eightId2 = deck.cards.find((c) => c.rank === '8' && c.id !== eightId).id;
    const pairRound = actingRound(state, boxId, [eightId, eightId2], 40);
    const splitResult = splitBlackjackPlayer(state.session, state.players, state.ledger, deck, pairRound, `${boxId}:0`, bankrollContextFromState(state), state.blackjackSettings);
    const handKeys = listHandKeysForPlayer(splitResult.round.playerHands, boxId);
    results.push(check('split creates separate hands', handKeys.length >= 2, handKeys.join(', ')));
    const doubleRound = actingRound(state, boxId, [findCardId(deck, '5'), findCardId(deck, '6')], 25);
    const doubleResult = doubleDownBlackjackPlayer(state.session, state.players, state.ledger, deck, doubleRound, `${boxId}:0`, bankrollContextFromState(state), state.blackjackSettings);
    const doubledHand = doubleResult.round.playerHands[`${boxId}:0`];
    results.push(check('double adds exactly one card then stands', doubledHand.doubled === true &&
        doubledHand.cardIds.length === 3 &&
        doubledHand.actionStatus === 'stood'));
    const vegasSettings = protocolToBlackjackSettings(LAS_VEGAS_PROTOCOL);
    const homeSettings = protocolToBlackjackSettings(CLASSIC_HOME_PROTOCOL);
    const naturalHand = {
        playerId: boxId,
        handIndex: 0,
        cardIds: [findCardId(deck, 'A'), findCardId(deck, 'K')],
        currentBet: 100,
        actionStatus: 'stood',
        fromSplit: false,
        doubled: false,
    };
    const naturalRound = {
        ...state.blackjack,
        status: 'banking',
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '8')],
        playerHands: { [`${boxId}:0`]: naturalHand },
    };
    const vegasResolve = resolveBlackjackRound(state.session, state.players, state.ledger, deck, naturalRound, vegasSettings, bankrollContextFromState(state));
    results.push(check('natural blackjack pays 3:2 under Las Vegas protocol', vegasResolve.round.outcomes?.[`${boxId}:0`] === 'blackjack-win' &&
        (vegasResolve.round.resultMessages?.[`${boxId}:0`]?.includes('150') ?? false), vegasResolve.round.resultMessages?.[`${boxId}:0`]));
    const homeResolve = resolveBlackjackRound(state.session, state.players, state.ledger, deck, naturalRound, homeSettings, bankrollContextFromState(state));
    results.push(check('natural blackjack pays 1:1 under Classic Home protocol', homeResolve.round.outcomes?.[`${boxId}:0`] === 'blackjack-win' &&
        (homeResolve.round.resultMessages?.[`${boxId}:0`]?.includes('200') ?? false), homeResolve.round.resultMessages?.[`${boxId}:0`]));
    const aceDeck = deckWithAceUp();
    const aceRound = createInsuranceRound(boxId, aceDeck);
    results.push(check('insurance offered when dealer Ace and protocol allows', shouldOfferInsurance(aceRound, aceDeck, vegasSettings)));
    results.push(check('insurance not offered under European Shoe', !shouldOfferInsurance(aceRound, aceDeck, protocolToBlackjackSettings(EUROPEAN_SHOE_PROTOCOL))));
    const tenDeck = deckWithTenUp();
    const tenRound = createInsuranceRound(boxId, tenDeck);
    results.push(check('dealer Ace detection', dealerShowsAce(aceDeck, aceRound) && !dealerShowsAce(tenDeck, tenRound)));
    return { passed: results.every((r) => r.passed), results };
}
function createInsuranceRound(boxId, deck) {
    const upId = deck.cards[deck.drawOrder[0]].id;
    return {
        status: 'player-turns',
        playerHands: {
            [`${boxId}:0`]: {
                playerId: boxId,
                handIndex: 0,
                cardIds: [],
                currentBet: 50,
                actionStatus: 'betting',
                doubled: false,
                fromSplit: false,
            },
        },
        dealerCardIds: [upId],
        insuranceOfferPending: false,
        activeHandKey: null,
        activePlayerId: null,
        splitCounts: {},
        dealerHoleHidden: true,
        outcomes: {},
        resultMessages: {},
    };
}
