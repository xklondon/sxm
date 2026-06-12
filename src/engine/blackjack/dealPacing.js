import { getCardDealDelayMs } from './flowSettings';
/** Delay before the next card is revealed — uses table deal speed preset. */
export function waitForDealPaceMs(state, context = 'initial-deal') {
    return getCardDealDelayMs(state, context);
}
/** Pause after a hand result before the next box/hand. */
export function waitForResultHoldMs(state) {
    return getCardDealDelayMs(state, 'result-hold');
}
export function waitForDealPaceFromSettings(settings, context = 'initial-deal') {
    return getCardDealDelayMs({ blackjackFlowSettings: settings }, context);
}
export function waitForResultHoldFromSettings(settings) {
    return getCardDealDelayMs({ blackjackFlowSettings: settings }, 'result-hold');
}
export function sleepMs(ms) {
    if (ms <= 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}
