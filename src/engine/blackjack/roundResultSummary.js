import { boxLabelForPlayer } from '../session/boxOps';
import { resolveBankrollOwnerIdForBox } from '../session/bankroll';
import { cardsFromIds, getBlackjackHandValue } from './hand';
import { orderedHandKeys } from './helpers';
function personLabel(state, boxPlayerId) {
    const ownerId = resolveBankrollOwnerIdForBox(state, boxPlayerId);
    const person = state.players[ownerId];
    return person?.controllerName || person?.displayName || boxLabelForPlayer(state, boxPlayerId);
}
function outcomeLine(state, handKey, outcome, bet, playerTotal) {
    const hand = state.blackjack.playerHands[handKey];
    const boxLabel = boxLabelForPlayer(state, hand.playerId);
    const who = personLabel(state, hand.playerId);
    switch (outcome) {
        case 'loss':
            return `${boxLabel}: ${playerTotal} loses — bank wins ${bet}.`;
        case 'win':
            return `${boxLabel}: ${playerTotal} wins — ${who} wins ${bet}.`;
        case 'blackjack-win': {
            const winnings = Math.floor(bet * state.blackjackSettings.blackjackPayout);
            return `${boxLabel}: Blackjack — ${who} wins ${winnings + bet} (${winnings} + bet).`;
        }
        case 'push':
        case 'blackjack-push':
            return `${boxLabel}: ${playerTotal} pushes — bet returned.`;
        default:
            return `${boxLabel}: ${playerTotal} — ${outcome}.`;
    }
}
/** Human-readable per-box result lines after settlement. */
export function buildRoundResultSummary(state) {
    const round = state.blackjack;
    if (!round || !state.deck || !round.isSettled) {
        return [];
    }
    const lines = [];
    const dealerCards = cardsFromIds(state.deck, round.dealerCardIds.filter(Boolean));
    const dealerVal = getBlackjackHandValue(dealerCards);
    lines.push(`Bank ${dealerVal.value}.`);
    for (const handKey of orderedHandKeys(state.session, round)) {
        const hand = round.playerHands[handKey];
        const outcome = round.outcomes[handKey];
        if (!hand || hand.currentBet <= 0 || !outcome) {
            continue;
        }
        const playerCards = cardsFromIds(state.deck, hand.cardIds.filter(Boolean));
        const playerTotal = getBlackjackHandValue(playerCards).value;
        lines.push(outcomeLine(state, handKey, outcome, hand.currentBet, playerTotal));
    }
    return lines;
}
export function formatRoundResultSummary(state) {
    const lines = buildRoundResultSummary(state);
    if (lines.length === 0) {
        return 'Round complete — review results, then press Next Round.';
    }
    return lines.join('\n');
}
