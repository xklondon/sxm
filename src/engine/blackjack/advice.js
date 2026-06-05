import { reasonAidAdvice, formatAidStructuredAdvice, } from './aid';
import { getBlackjackProtocolForState } from './protocolState';
/** Structured AID output — protocol + intel + strategy lookup. */
export function getStructuredAidAdvice(round, handKey, deck, flowSettings, gameState, ledger) {
    const protocol = gameState
        ? getBlackjackProtocolForState(gameState)
        : undefined;
    return reasonAidAdvice({
        round,
        handKey,
        deck,
        flowSettings,
        ledger,
        protocol,
        gameState,
    });
}
/** Local deterministic AID — thin wrapper over reasoner for UI compatibility. */
export function getAidAdvice(round, handKey, deck, flowSettings, gameState, ledger) {
    const protocol = gameState
        ? getBlackjackProtocolForState(gameState)
        : undefined;
    const structured = reasonAidAdvice({
        round,
        handKey,
        deck,
        flowSettings,
        ledger,
        protocol,
        gameState,
    });
    if (!structured) {
        return null;
    }
    const result = {
        text: formatAidStructuredAdvice(structured),
        structured,
    };
    if (flowSettings.adviceCostMode === 'bank-offer') {
        result.costNote = 'bank-offer';
    }
    return result;
}
