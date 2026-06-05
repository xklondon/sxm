import { buildInitialDealPlan, } from '../initialDeal';
function stepLabel(step) {
    if (step.type === 'dealer') {
        return step.cardIndex === 0 ? 'Bank up-card' : 'Bank hole card';
    }
    return `Box ${step.handKey} card ${step.cardIndex + 1}`;
}
/** Ordered one-card-at-a-time plan for natural dealing (right-to-left box order preserved). */
export function buildNaturalDealSequence(session, round) {
    const plan = buildInitialDealPlan(session, round);
    return plan.map((step, stepIndex) => ({
        stepIndex,
        label: stepLabel(step),
        type: step.type,
        handKey: step.type === 'box' ? step.handKey : undefined,
        cardIndex: step.cardIndex,
    }));
}
export function naturalDealProgress(round, totalSteps) {
    const current = round.initialDealStepIndex ?? 0;
    return {
        current,
        total: totalSteps,
        complete: round.status !== 'initial-deal' || current >= totalSteps,
    };
}
