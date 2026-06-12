import { getAvailableChipsForBankrollOwner } from '../../session/bankroll';
import { addChipToBoxStake, clearBoxStake, getStakeForBox, removeLastChipFromBoxStake, } from '../stakes';
import { canDoubleBlackjackForState } from '../validation';
import { formatInsufficientChipsMessage, isInsufficientChipsMessage, setPersonPlayFlow, } from '../playFlow';
import { processPlayFlowAutoStands } from '../gameState';
import { BUST_MESSAGE, settleBustHandOnState } from '../bustSettlement';
import { buildGameOverSummary, addGameToPersonalLedger } from '../../scoreLedger/scoreLedger';
import { setBlackjackProtocolOnState } from '../protocolState';
import { EUROPEAN_SHOE_PROTOCOL, LAS_VEGAS_PROTOCOL } from '../protocols';
import { blackjackHandKey } from '../handKeys';
import { check } from './types';
import { actingRound, boxPlayerId, findCardId, tableWithClaimedBox } from './fixtures';
import { loadScoreLedgerEntries, saveScoreLedgerEntries, } from '../../../storage/scoreLedgerStorage';
export function runGameplayUxSanityChecks() {
    const results = [];
    const chipMsg = formatInsufficientChipsMessage(35, 50);
    results.push(check('insufficient chips message is tray-hint format', isInsufficientChipsMessage(chipMsg) && chipMsg.includes('available 35') && chipMsg.includes('need 50'), chipMsg));
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1);
    const personId = state.tableMeta.ownerPersonId;
    const availableBefore = getAvailableChipsForBankrollOwner(state, personId);
    state = addChipToBoxStake(state, boxId, 50, personId);
    const availableAfterBet = getAvailableChipsForBankrollOwner(state, personId);
    results.push(check('placing bet reduces available chips', availableAfterBet === availableBefore - 50, `${availableBefore} -> ${availableAfterBet}`));
    state = removeLastChipFromBoxStake(state, boxId);
    const availableAfterRemove = getAvailableChipsForBankrollOwner(state, personId);
    results.push(check('remove bet before deal restores available', availableAfterRemove === availableBefore && getStakeForBox(state, boxId) === 0, `${availableAfterRemove}`));
    state = tableWithClaimedBox(1);
    const boxId2 = boxPlayerId(state, 1);
    const personId2 = state.tableMeta.ownerPersonId;
    state = addChipToBoxStake(state, boxId2, 10, personId2);
    state = addChipToBoxStake(state, boxId2, 5, personId2);
    state = removeLastChipFromBoxStake(state, boxId2);
    results.push(check('remove last chip reduces stake by one chip', getStakeForBox(state, boxId2) === 10, String(getStakeForBox(state, boxId2))));
    state = clearBoxStake(state, boxId2);
    results.push(check('clear bet removes all stake chips', getStakeForBox(state, boxId2) === 0));
    state = tableWithClaimedBox(1);
    const hard11Box = boxPlayerId(state, 1);
    const deck = state.deck;
    const five = findCardId(deck, '5');
    const six = findCardId(deck, '6');
    state = {
        ...state,
        blackjackProtocolId: LAS_VEGAS_PROTOCOL.id,
        blackjack: actingRound(state, hard11Box, [five, six], 25),
    };
    results.push(check('double enabled on hard 11 (Las Vegas)', canDoubleBlackjackForState(state, `${hard11Box}:0`)));
    state = setBlackjackProtocolOnState(state, EUROPEAN_SHOE_PROTOCOL.id, 'Alice');
    results.push(check('double enabled on hard 11 (European)', canDoubleBlackjackForState({ ...state, blackjack: actingRound(state, hard11Box, [five, six], 25) }, `${hard11Box}:0`)));
    const four = findCardId(deck, '4');
    state = {
        ...state,
        blackjack: actingRound(state, hard11Box, [four, four], 25),
    };
    results.push(check('double disabled on hard 8 (European)', !canDoubleBlackjackForState(state, `${hard11Box}:0`)));
    state = tableWithClaimedBox(1);
    const autoBox = boxPlayerId(state, 1);
    const autoPerson = state.tableMeta.ownerPersonId;
    state = setPersonPlayFlow(state, autoPerson, 'auto-18');
    const ten = findCardId(deck, '10');
    const eight = findCardId(deck, '8');
    state = {
        ...state,
        blackjack: actingRound(state, autoBox, [ten, eight], 25),
    };
    const autoResult = processPlayFlowAutoStands(state);
    const autoHand = autoResult.blackjack?.playerHands[`${autoBox}:0`];
    results.push(check('auto-stand on 18+ stands acting hand', autoHand?.actionStatus === 'stood', autoHand?.actionStatus));
    state = tableWithClaimedBox(1);
    const bustBox = boxPlayerId(state, 1);
    const handKey = blackjackHandKey(bustBox, 0);
    const bustRound = actingRound(state, bustBox, [ten, findCardId(deck, '9'), findCardId(deck, '5')], 40);
    bustRound.playerHands[handKey].actionStatus = 'busted';
    state = { ...state, blackjack: bustRound };
    const bustState = settleBustHandOnState(state, handKey);
    const bustHand = bustState.blackjack?.playerHands[handKey];
    results.push(check('bust keeps cards visible and marks settled', (bustHand?.cardIds.length ?? 0) > 0 && bustHand?.bustSettled === true));
    results.push(check('bust message recorded', bustState.blackjack?.resultMessages[handKey] === BUST_MESSAGE));
    const endBase = tableWithClaimedBox(1);
    const endBankId = endBase.session.bankPlayerId;
    // Personal ledger applies to human-vs-human games only, so use a human banker.
    const endState = {
        ...endBase,
        players: {
            ...endBase.players,
            [endBankId]: { ...endBase.players[endBankId], playerType: 'real' },
        },
        tableMeta: {
            ...endBase.tableMeta,
            gameStatus: 'ended',
            winnerId: endBankId,
            agreement: {
                stakeDescription: '$5',
                defaultChips: 500,
                agreedAt: new Date().toISOString(),
            },
        },
    };
    const { message, entry } = buildGameOverSummary(endState);
    results.push(check('game-over message uses congrats format', message.includes('Game Over, congrats')));
    results.push(check('game-over message includes round count', message.includes('rounds.')));
    results.push(check('game-over message includes final chip totals', message.includes('Final chips:') || message.includes('Final totals:')));
    results.push(check('score ledger entry preview at game over', entry !== null && entry.owedDescription.includes('$5')));
    if (typeof globalThis.localStorage === 'undefined') {
        const bag = {};
        globalThis.localStorage = {
            getItem: (key) => bag[key] ?? null,
            setItem: (key, value) => {
                bag[key] = value;
            },
            removeItem: (key) => {
                delete bag[key];
            },
            clear: () => {
                for (const key of Object.keys(bag)) {
                    delete bag[key];
                }
            },
            key: (index) => Object.keys(bag)[index] ?? null,
            length: 0,
        };
    }
    saveScoreLedgerEntries([]);
    addGameToPersonalLedger(endState);
    results.push(check('personal ledger entry persisted on user add', loadScoreLedgerEntries().some((e) => e.tableId === endState.session.id)));
    return {
        passed: results.every((r) => r.passed),
        results,
    };
}
