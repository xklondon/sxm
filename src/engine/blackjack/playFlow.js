export { PLAY_FLOW_OPTIONS } from '../../storage/profileStorage';
import { getAutoStandDecisionTotal, getBlackjackHandValue } from './hand';
import { canDoubleBlackjackForState, canSplitBlackjackForState, getPlayerOptionalActionGateIfActing, } from './validation';
export function getPlayFlowForPerson(state, personId) {
    return state.tableMeta.personPlayFlow?.[personId] ?? 'auto-18';
}
export function setPersonPlayFlow(state, personId, playFlow) {
    return {
        ...state,
        tableMeta: {
            ...state.tableMeta,
            personPlayFlow: {
                ...state.tableMeta.personPlayFlow,
                [personId]: playFlow,
            },
        },
    };
}
/** Minimum hand total that triggers auto-stand; null when manual. */
export function autoStandThreshold(playFlow) {
    switch (playFlow) {
        case 'auto-18':
            return 18;
        case 'auto-19':
            return 19;
        case 'auto-20':
            return 20;
        case 'auto-21':
            return 21;
        default:
            return null;
    }
}
export function shouldAutoStandHandValue(playFlow, handTotal) {
    const threshold = autoStandThreshold(playFlow);
    return threshold !== null && handTotal >= threshold;
}
/** Auto-stand uses hard/minimum total when the hand contains an ace. */
export function shouldAutoStandHand(playFlow, cards) {
    const { value, isBlackjack } = getBlackjackHandValue(cards);
    if (isBlackjack || value > 21) {
        return false;
    }
    const threshold = autoStandThreshold(playFlow);
    if (threshold === null) {
        return false;
    }
    return getAutoStandDecisionTotal(cards) >= threshold;
}
/**
 * Whether the engine may auto-stand a player hand.
 * Optional Split/Double choices block auto-stop even when the threshold is met.
 */
export function shouldAutoStopPlayerHand(playFlow, cards, actionGate) {
    if (actionGate.canSplit || actionGate.canDouble) {
        return false;
    }
    return shouldAutoStandHand(playFlow, cards);
}
/** Live gate check for an acting hand — same legality as UI action options. */
export function shouldAutoStopPlayerHandForState(state, handKey, playFlow, cards) {
    return shouldAutoStopPlayerHand(playFlow, cards, {
        canSplit: canSplitBlackjackForState(state, handKey),
        canDouble: canDoubleBlackjackForState(state, handKey),
    });
}
/** Retrospective check after stand — treats hand as acting to detect skipped optional actions. */
export function handWasAutoStoppedByEngine(state, handKey, playFlow, cards) {
    return shouldAutoStopPlayerHand(playFlow, cards, getPlayerOptionalActionGateIfActing(state, handKey));
}
/** Chip-tray hint format for insufficient balance during betting. */
export function formatInsufficientChipsMessage(available, need) {
    return `Not enough chips — available ${available}, need ${need}`;
}
export function isInsufficientChipsMessage(message) {
    return /not enough chips/i.test(message);
}
