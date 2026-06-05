import { getBlackjackHandValue } from './hand';
import { log } from '../../utils/logger';
/** Protocol-aware dealer draw decision — never stand below hitBelow unless bust. */
export function evaluateDealerDraw(dealerCards, settings, protocol) {
    const hitBelow = protocol?.dealer.hitBelow ?? 17;
    const standsOnSoft17 = protocol?.dealer.standsOnSoft17 ?? settings?.dealerStandsOnSoft17 ?? true;
    const dealerValue = getBlackjackHandValue(dealerCards);
    const { value: dealerTotal, isSoft } = dealerValue;
    if (dealerTotal > 21) {
        return {
            shouldDraw: false,
            dealerTotal,
            isSoft,
            hitBelow,
            standsOnSoft17,
            reason: 'dealer bust',
        };
    }
    if (dealerTotal < hitBelow) {
        return {
            shouldDraw: true,
            dealerTotal,
            isSoft,
            hitBelow,
            standsOnSoft17,
            reason: `total ${dealerTotal} below ${hitBelow}`,
        };
    }
    if (dealerTotal === 17 && isSoft && !standsOnSoft17) {
        return {
            shouldDraw: true,
            dealerTotal,
            isSoft,
            hitBelow,
            standsOnSoft17,
            reason: 'H17 — hit soft 17',
        };
    }
    return {
        shouldDraw: false,
        dealerTotal,
        isSoft,
        hitBelow,
        standsOnSoft17,
        reason: dealerTotal === 17 && isSoft
            ? 'S17 — stand on soft 17'
            : `stand on ${dealerTotal}${isSoft ? ' (soft)' : ''}`,
    };
}
export function shouldDealerDraw(dealerCards, settings, protocol) {
    return evaluateDealerDraw(dealerCards, settings, protocol).shouldDraw;
}
export function logDealerDrawDecision(context, dealerCards, decision, protocol) {
    log.info('dealerDrawDecision', {
        context,
        dealerCards: dealerCards.map((c) => `${c.rank}${c.suit[0]}`),
        dealerTotal: decision.dealerTotal,
        isSoft: decision.isSoft,
        selectedProtocolId: protocol?.protocolId ?? null,
        dealerDrawRule: protocol?.dealerDrawRule ?? null,
        shouldDealerDraw: decision.shouldDraw,
        bankPhaseTransitionReason: decision.reason,
    });
}
