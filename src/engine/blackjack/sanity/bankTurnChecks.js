import { cardsFromIds, getBlackjackHandValue } from '../hand';
import { evaluateDealerDraw, shouldDealerDraw, } from '../dealerDraw';
import { bankNeedsAnotherCard, drawSingleBankCard, enterBankingIfComplete, } from '../bankTurn';
import { LAS_VEGAS_PROTOCOL, EUROPEAN_SHOE_PROTOCOL, protocolToBlackjackSettings, } from '../protocols';
import { createEmptyBlackjackRound } from '../../../types/blackjack';
import { check } from './types';
import { baseTestTable, findCardId, tableWithClaimedBox, boxPlayerId } from './fixtures';
import { createBlackjackPlayerHand } from '../../../types/blackjack';
import { blackjackHandKey } from '../handKeys';
function dealerRound(dealerCardIds) {
    return {
        ...createEmptyBlackjackRound(),
        status: 'bank-turn',
        dealerCardIds,
        dealerHoleHidden: false,
    };
}
function runBankDrawUntilStand(session, players, deck, round, settings, protocol = LAS_VEGAS_PROTOCOL) {
    let currentRound = round;
    let currentDeck = deck;
    let draws = 0;
    let guard = 0;
    while (currentRound.status === 'bank-turn' && guard < 12) {
        guard += 1;
        const result = drawSingleBankCard(session, players, currentDeck, currentRound, settings, protocol);
        currentRound = result.round;
        currentDeck = result.deck;
        if (result.cardId) {
            draws += 1;
        }
        if (result.complete) {
            break;
        }
    }
    return { round: currentRound, deck: currentDeck, draws };
}
function cardRankValues(deck, ids) {
    return cardsFromIds(deck, ids.filter(Boolean));
}
export function runBankTurnSanityChecks() {
    const results = [];
    const vegasSettings = protocolToBlackjackSettings(LAS_VEGAS_PROTOCOL);
    const europeanSettings = protocolToBlackjackSettings(EUROPEAN_SHOE_PROTOCOL);
    const table = baseTestTable();
    const deck = table.deck;
    const session = table.session;
    const players = table.players;
    const ids13 = [findCardId(deck, '8'), findCardId(deck, '5')];
    const cards13 = cardRankValues(deck, ids13);
    results.push(check('dealer total 13 must draw (evaluateDealerDraw)', evaluateDealerDraw(cards13, vegasSettings, LAS_VEGAS_PROTOCOL).shouldDraw === true));
    results.push(check('dealer total 13 must draw (bankNeedsAnotherCard)', bankNeedsAnotherCard(cards13, vegasSettings, LAS_VEGAS_PROTOCOL) === true));
    const drawn = runBankDrawUntilStand(session, players, deck, dealerRound(ids13), vegasSettings);
    const finalCards = cardRankValues(drawn.deck, drawn.round.dealerCardIds);
    const finalValue = getBlackjackHandValue(finalCards).value;
    results.push(check('dealer never stands on 13 — draws until 17+', finalValue >= 17 || finalValue > 21, `final=${finalValue} draws=${drawn.draws}`));
    results.push(check('dealer with 13 ends in banking or bank-turn only after 17+', drawn.round.status === 'banking' || drawn.round.status === 'bank-turn'));
    const ids16 = [findCardId(deck, '10'), findCardId(deck, '6')];
    const cards16 = cardRankValues(deck, ids16);
    results.push(check('dealer total 16 must draw', shouldDealerDraw(cards16, vegasSettings, LAS_VEGAS_PROTOCOL)));
    const idsHard17 = [findCardId(deck, '10'), findCardId(deck, '7')];
    const cardsHard17 = cardRankValues(deck, idsHard17);
    results.push(check('dealer hard 17 must stand (S17)', shouldDealerDraw(cardsHard17, vegasSettings, LAS_VEGAS_PROTOCOL) === false));
    const idsSoft17 = [findCardId(deck, 'A'), findCardId(deck, '6')];
    const cardsSoft17 = cardRankValues(deck, idsSoft17);
    results.push(check('dealer soft 17 stands on S17 protocol', shouldDealerDraw(cardsSoft17, vegasSettings, LAS_VEGAS_PROTOCOL) === false));
    const h17Protocol = {
        ...LAS_VEGAS_PROTOCOL,
        dealer: { ...LAS_VEGAS_PROTOCOL.dealer, standsOnSoft17: false },
        dealerDrawRule: 'Hit soft 17 (H17).',
    };
    const h17Settings = protocolToBlackjackSettings(h17Protocol);
    results.push(check('dealer soft 17 hits on H17 protocol', shouldDealerDraw(cardsSoft17, h17Settings, h17Protocol) === true));
    const entered = enterBankingIfComplete(dealerRound(idsHard17), deck, vegasSettings, LAS_VEGAS_PROTOCOL);
    results.push(check('enterBankingIfComplete transitions hard 17 to banking', entered.status === 'banking'));
    results.push(check('enterBankingIfComplete keeps bank-turn when dealer at 13', enterBankingIfComplete(dealerRound(ids13), deck, vegasSettings, LAS_VEGAS_PROTOCOL).status ===
        'bank-turn'));
    results.push(check('European S17: dealer 13 draws', shouldDealerDraw(cards13, europeanSettings, EUROPEAN_SHOE_PROTOCOL)));
    const bustTable = tableWithClaimedBox(1);
    const bustBox = boxPlayerId(bustTable, 1);
    const bustHandKey = blackjackHandKey(bustBox, 0);
    const bustRound = {
        ...createEmptyBlackjackRound(),
        status: 'bank-turn',
        dealerCardIds: [findCardId(bustTable.deck, '10'), findCardId(bustTable.deck, '6')],
        dealerHoleHidden: true,
        playerHands: {
            [bustHandKey]: {
                ...createBlackjackPlayerHand(bustBox, 0),
                cardIds: [],
                currentBet: 50,
                actionStatus: 'busted',
                bustSettled: true,
            },
        },
        outcomes: { [bustHandKey]: 'loss' },
        resultMessages: { [bustHandKey]: 'BUST' },
    };
    const bustDeckBefore = bustTable.deck.cards.length;
    const bustDraw = drawSingleBankCard(bustTable.session, bustTable.players, bustTable.deck, bustRound, vegasSettings, LAS_VEGAS_PROTOCOL);
    results.push(check('all busted boxes skip bank draw — zero dealer cards added', bustDraw.cardId === null &&
        bustDraw.round.status === 'banking' &&
        bustDraw.deck.cards.length === bustDeckBefore));
    const natTable = tableWithClaimedBox(1);
    const natBox = boxPlayerId(natTable, 1);
    const natHandKey = blackjackHandKey(natBox, 0);
    const natRound = {
        ...createEmptyBlackjackRound(),
        status: 'bank-turn',
        dealerCardIds: [findCardId(natTable.deck, '9'), findCardId(natTable.deck, '7')],
        dealerHoleHidden: false,
        playerHands: {
            [natHandKey]: {
                ...createBlackjackPlayerHand(natBox, 0),
                cardIds: [findCardId(natTable.deck, 'A'), findCardId(natTable.deck, 'K')],
                currentBet: 25,
                actionStatus: 'done',
                naturalSettled: true,
            },
        },
        outcomes: { [natHandKey]: 'win' },
    };
    const natDeckBefore = natTable.deck.cards.length;
    const natDraw = drawSingleBankCard(natTable.session, natTable.players, natTable.deck, natRound, vegasSettings, LAS_VEGAS_PROTOCOL);
    results.push(check('natural-blackjack-paid skips bank draw — zero dealer cards added', natDraw.cardId === null &&
        natDraw.round.status === 'banking' &&
        natDraw.deck.cards.length === natDeckBefore));
    return { passed: results.every((r) => r.passed), results };
}
