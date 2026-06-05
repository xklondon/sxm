import { buildInitialDealPlan } from './initialDeal';
import { parseBlackjackHandKey } from './handKeys';
/** UI reveal targets in the same order as {@link buildInitialDealPlan}. */
export function buildInitialDealSequence(session, round) {
    const holeLast = !round.dealerCardIds[1];
    const plan = buildInitialDealPlan(session, round, holeLast);
    const steps = [];
    for (const step of plan) {
        if (step.type === 'box') {
            const hand = round.playerHands[step.handKey];
            const cardId = hand?.cardIds[step.cardIndex];
            if (!cardId) {
                continue;
            }
            steps.push({
                type: 'box',
                handKey: step.handKey,
                playerId: parseBlackjackHandKey(step.handKey).playerId,
                cardIndex: step.cardIndex,
                cardId,
            });
            continue;
        }
        const cardId = round.dealerCardIds[step.cardIndex];
        if (!cardId) {
            continue;
        }
        steps.push({
            type: 'dealer',
            cardIndex: step.cardIndex,
            cardId,
            faceDown: step.cardIndex === 1 ? round.dealerHoleHidden : undefined,
        });
    }
    return steps;
}
