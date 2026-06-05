import { cardsFromIds, getBlackjackHandValue } from './hand';
import { blackjackHandKey, parseBlackjackHandKey } from './handKeys';
function shortResult(message) {
    const lower = message.toLowerCase();
    if (lower.includes('blackjack')) {
        return 'Blackjack. Genius.';
    }
    if (lower.includes('bust')) {
        return 'Bust.';
    }
    if (lower.includes('push')) {
        return 'Push.';
    }
    if (lower.includes('win')) {
        return message.length > 40 ? 'You win.' : message;
    }
    if (lower.includes('loss') || lower.includes('lost')) {
        return message.length > 40 ? 'You lose.' : message;
    }
    return message.length > 36 ? `${message.slice(0, 33)}…` : message;
}
/** Short box status for UI — derived from round phase and hand state. */
export function getBoxComment(state, boxId) {
    const { session, blackjack: round, deck } = state;
    if (!round) {
        return 'Place your bet.';
    }
    const handKey = blackjackHandKey(boxId, 0);
    const hand = round.playerHands[handKey];
    const slotNum = session.boxSlotNumbers?.[boxId];
    const boxLabel = slotNum ? `Box ${slotNum}` : 'This box';
    switch (round.status) {
        case 'betting':
            if ((hand?.currentBet ?? 0) > 0) {
                return 'Bet confirmed.';
            }
            return 'Place your bet.';
        case 'initial-deal':
            return 'Dealing…';
        case 'player-turns': {
            const activeId = round.activeHandKey
                ? parseBlackjackHandKey(round.activeHandKey).playerId
                : null;
            const isActive = activeId === boxId;
            if (isActive && hand) {
                if (deck && hand.cardIds.length > 0) {
                    const { value } = getBlackjackHandValue(cardsFromIds(deck, hand.cardIds));
                    return `Your turn. You have ${value}.`;
                }
                return 'Your turn.';
            }
            if (hand?.actionStatus === 'stood') {
                return 'Standing.';
            }
            if (hand?.actionStatus === 'busted') {
                return 'Bust.';
            }
            if (hand?.actionStatus === 'blackjack') {
                return 'Blackjack.';
            }
            return `Waiting — ${boxLabel} up soon.`;
        }
        case 'bank-turn':
            return 'Waiting for bank.';
        case 'banking': {
            const msg = round.resultMessages[handKey];
            if (msg && hand && hand.currentBet > 0) {
                return shortResult(msg);
            }
            return 'Settling…';
        }
        case 'resolved': {
            const msg = round.resultMessages[handKey];
            if (msg && hand && hand.currentBet > 0) {
                if (deck && hand.cardIds.length > 0) {
                    const { value } = getBlackjackHandValue(cardsFromIds(deck, hand.cardIds));
                    const dealerVal = deck && round.dealerCardIds.length > 0
                        ? getBlackjackHandValue(cardsFromIds(deck, round.dealerCardIds)).value
                        : null;
                    if (dealerVal !== null && msg.toLowerCase().includes('loss')) {
                        return `Bank has ${dealerVal} — you lose.`;
                    }
                    if (dealerVal !== null && msg.toLowerCase().includes('win')) {
                        return `You have ${value}. You win.`;
                    }
                }
                return shortResult(msg);
            }
            return 'Hand over.';
        }
        default:
            return 'Place your bet.';
    }
}
export function getBankLabel(state) {
    const setup = state.tableMeta.bankerSetup;
    if (setup.mode === 'bot') {
        return 'Bank Bot';
    }
    if (setup.mode === 'person' && setup.displayName) {
        return setup.displayName;
    }
    const bankId = state.session.bankPlayerId;
    if (!bankId) {
        return 'Not set';
    }
    const bank = state.players[bankId];
    if (!bank) {
        return 'Not set';
    }
    if (bank.playerType === 'virtual') {
        return 'Bank Bot';
    }
    return bank.controllerName || bank.displayName;
}
