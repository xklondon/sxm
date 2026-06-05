import { getBlackjackProtocolForState } from './protocolState';
import { boxLabelForPlayer } from '../session/boxOps';
import { parseBlackjackHandKey } from './handKeys';
import { isCustomProtocolId } from '../protocols/customProtocolTypes';
import { findCustomProtocolByStorageId } from '../../storage/customProtocolStorage';
import { listCustomRuleReminders } from '../protocols/customProtocolBuilder';
import { formatRoundResultSummary } from './roundResultSummary';
import { getGameOverMessage } from '../session/tableGameEnd';
import { hasEligibleDealBoxes } from './dealEligibility';
const DEFAULT_MESSAGES = {
    betting: 'Place your bets.',
    dealing: 'Cards.',
    insurance: 'Dealer shows Ace — insurance offered when protocol allows.',
    player: 'Your turn.',
    bank: 'Bank draws.',
    banking: 'Banking.',
    'round-complete': 'Round complete — review results, then press Next Round.',
};
function customMessagesForPhase(phase, custom) {
    if (!custom) {
        return null;
    }
    const m = custom.protocolSpecificMessages;
    switch (phase) {
        case 'betting':
            return m.bettingMessage ?? null;
        case 'dealing':
            return m.dealMessage ?? null;
        case 'player':
            return m.playerTurnMessage ?? null;
        case 'bank':
            return m.bankTurnMessage ?? null;
        case 'banking':
            return m.payoutMessage ?? null;
        default:
            return null;
    }
}
function protocolDoubleHint(state) {
    const protocol = getBlackjackProtocolForState(state);
    if (protocol.double.allowedHardTotals === 'any') {
        return `${protocol.displayName}: double allowed on any first two cards.`;
    }
    const totals = protocol.double.allowedHardTotals.join(', ');
    return `${protocol.displayName}: double on hard ${totals} only.`;
}
function customRuleLines(state) {
    const id = state.blackjackProtocolId;
    if (!isCustomProtocolId(id)) {
        return [];
    }
    const custom = findCustomProtocolByStorageId(id);
    if (!custom) {
        return [];
    }
    return listCustomRuleReminders(custom);
}
/** Protocol-aware table comment for center status / box hints. */
export function getProtocolMessage(state, phase, context = {}) {
    const round = state.blackjack;
    if (state.tableMeta.gameStatus === 'ended') {
        return getGameOverMessage(state);
    }
    if (phase === 'round-complete' || (phase === 'betting' && state.tableMeta.awaitingNextRound)) {
        const summary = formatRoundResultSummary(state);
        if (summary && !summary.startsWith('Round complete —')) {
            return summary;
        }
    }
    if (phase === 'betting' && round?.status === 'resolved' && !state.tableMeta.awaitingNextRound) {
        return 'Review results — place bets, then Deal Cards.';
    }
    if (phase === 'betting' && !state.tableMeta.shoeStarted) {
        return customMessagesForPhase(phase, findCustomProtocolByStorageId(state.blackjackProtocolId)) ??
            'Place your bets, then Shuffle to start.';
    }
    if (phase === 'betting' && state.tableMeta.shoeStarted) {
        if (hasEligibleDealBoxes(state)) {
            return 'Ready — press Deal Cards.';
        }
        const custom = customMessagesForPhase(phase, findCustomProtocolByStorageId(state.blackjackProtocolId));
        const base = custom ?? 'Place your bets, then Deal Cards.';
        const hints = [protocolDoubleHint(state), ...customRuleLines(state)].filter(Boolean);
        return hints.length > 0 ? `${base} ${hints[0]}` : base;
    }
    if (phase === 'player' && round?.activeHandKey) {
        const { playerId } = parseBlackjackHandKey(round.activeHandKey);
        const boxLabel = boxLabelForPlayer(state, playerId);
        const custom = customMessagesForPhase(phase, findCustomProtocolByStorageId(state.blackjackProtocolId));
        if (custom) {
            return custom.replace('{box}', boxLabel);
        }
        if (context.activeBoxId === playerId) {
            return `${boxLabel}: your turn.`;
        }
        return `${boxLabel}: your turn.`;
    }
    const custom = customMessagesForPhase(phase, findCustomProtocolByStorageId(state.blackjackProtocolId));
    if (custom) {
        return custom;
    }
    if (phase === 'betting') {
        return DEFAULT_MESSAGES.betting;
    }
    const reminders = customRuleLines(state);
    const base = DEFAULT_MESSAGES[phase] ?? 'Place your bets.';
    if (reminders.length > 0 && (phase === 'bank' || phase === 'player')) {
        return `${base} ${reminders[0]}`;
    }
    return base;
}
