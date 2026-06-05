import { drawCard } from '../deck/deck';
import { getBlackjackHandValue, cardsFromIds } from './hand';
import { assertRoundStatus, handKeysWithConfirmedBets, syncActivePlayerId, syncPlayerBetsFromRound, } from './helpers';
import { activateInsuranceOfferIfNeeded, shouldOfferInsurance } from './insurance';
import { canOfferInsuranceAfterInitialDeal } from './initialDealGuards';
import { findNextActingHand } from './virtual';
export function buildInitialDealPlan(session, round, holeCardDealtLast = false) {
    const handKeys = round.initialDealHandKeys?.length
        ? round.initialDealHandKeys
        : handKeysWithConfirmedBets(session, round);
    return buildInitialDealPlanFromHandKeys(handKeys, holeCardDealtLast);
}
export function buildInitialDealPlanFromHandKeys(handKeys, holeCardDealtLast = false) {
    const steps = [];
    for (const handKey of handKeys) {
        steps.push({ type: 'box', handKey, cardIndex: 0 });
    }
    steps.push({ type: 'dealer', cardIndex: 0 });
    for (const handKey of handKeys) {
        steps.push({ type: 'box', handKey, cardIndex: 1 });
    }
    if (!holeCardDealtLast) {
        steps.push({ type: 'dealer', cardIndex: 1 });
    }
    return steps;
}
function cardsForHand(_deck, handKey, round) {
    return [...(round.playerHands[handKey]?.cardIds ?? [])];
}
export function beginInitialDeal(session, players, deck, round, handKeysOverride, settings) {
    assertRoundStatus(round, ['betting'], 'begin initial deal');
    const handKeys = handKeysOverride ?? handKeysWithConfirmedBets(session, round);
    const plan = buildInitialDealPlanFromHandKeys(handKeys, settings?.holeCardDealtLast ?? false);
    if (plan.length === 0) {
        throw new Error('Add chips to a betting box first');
    }
    if (deck.drawOrder.length < plan.length) {
        throw new Error(`Deck needs at least ${plan.length} cards to deal`);
    }
    return {
        session,
        players,
        deck,
        round: {
            ...round,
            status: 'initial-deal',
            initialDealStepIndex: 0,
            initialDealHandKeys: handKeys,
            dealerCardIds: [],
            dealerHoleHidden: true,
        },
    };
}
function finalizeAfterInitialDeal(session, players, deck, round, settings, protocol) {
    const playerHandKeys = handKeysWithConfirmedBets(session, round);
    let nextRound = { ...round };
    delete nextRound.initialDealStepIndex;
    for (const handKey of playerHandKeys) {
        const hand = nextRound.playerHands[handKey];
        if (!hand) {
            continue;
        }
        const cards = cardsFromIds(deck, hand.cardIds);
        const { isBlackjack } = getBlackjackHandValue(cards);
        const actionStatus = isBlackjack ? 'blackjack' : 'acting';
        nextRound = {
            ...nextRound,
            playerHands: {
                ...nextRound.playerHands,
                [handKey]: { ...hand, actionStatus },
            },
        };
    }
    const firstActingHand = findNextActingHand(session, nextRound);
    const allInstant = firstActingHand === null &&
        playerHandKeys.every((handKey) => {
            const status = nextRound.playerHands[handKey]?.actionStatus;
            return status === 'blackjack' || status === 'busted';
        });
    const insuranceOffer = settings &&
        session &&
        canOfferInsuranceAfterInitialDeal(session, nextRound) &&
        shouldOfferInsurance(nextRound, deck, settings, protocol);
    if (insuranceOffer) {
        nextRound = activateInsuranceOfferIfNeeded(nextRound, deck, settings, session, protocol);
    }
    const insurancePending = Boolean(nextRound.insuranceOfferPending);
    nextRound = syncActivePlayerId({
        ...nextRound,
        activeHandKey: insurancePending ? null : firstActingHand,
        status: allInstant && !insurancePending ? 'bank-turn' : 'player-turns',
        dealerHoleHidden: insurancePending ? true : !allInstant,
    });
    return {
        session,
        players: syncPlayerBetsFromRound(players, nextRound),
        deck,
        round: nextRound,
    };
}
export function dealNextInitialCard(session, players, deck, round, settings, protocol) {
    assertRoundStatus(round, ['initial-deal'], 'deal initial card');
    const plan = buildInitialDealPlan(session, round, settings?.holeCardDealtLast ?? false);
    const stepIndex = round.initialDealStepIndex ?? 0;
    if (stepIndex >= plan.length) {
        throw new Error('Initial deal already complete');
    }
    const step = plan[stepIndex];
    const draw = drawCard(deck);
    if (!draw.card) {
        throw new Error('No cards remaining in deck');
    }
    let nextRound = { ...round };
    if (step.type === 'box') {
        const hand = nextRound.playerHands[step.handKey];
        if (!hand) {
            throw new Error(`Hand ${step.handKey} not found`);
        }
        const cardIds = cardsForHand(deck, step.handKey, nextRound);
        while (cardIds.length <= step.cardIndex) {
            cardIds.push('');
        }
        cardIds[step.cardIndex] = draw.card.id;
        nextRound = {
            ...nextRound,
            playerHands: {
                ...nextRound.playerHands,
                [step.handKey]: { ...hand, cardIds },
            },
        };
    }
    else {
        const dealerCardIds = [...nextRound.dealerCardIds];
        while (dealerCardIds.length <= step.cardIndex) {
            dealerCardIds.push('');
        }
        dealerCardIds[step.cardIndex] = draw.card.id;
        nextRound = {
            ...nextRound,
            dealerCardIds,
            dealerHoleHidden: step.cardIndex === 1,
        };
    }
    const nextIndex = stepIndex + 1;
    if (nextIndex >= plan.length) {
        const finalized = finalizeAfterInitialDeal(session, players, draw.deck, {
            ...nextRound,
            initialDealStepIndex: undefined,
        }, settings, protocol);
        return {
            ...finalized,
            step,
            cardId: draw.card.id,
            complete: true,
        };
    }
    return {
        session,
        players,
        deck: draw.deck,
        round: { ...nextRound, initialDealStepIndex: nextIndex },
        step,
        cardId: draw.card.id,
        complete: false,
    };
}
/** Deal all initial cards at once (engine shortcut). */
export function dealInitialBlackjackCardsFast(session, players, deck, round, settings, protocol) {
    let state = beginInitialDeal(session, players, deck, round, undefined, settings);
    let guard = 0;
    while (state.round.status === 'initial-deal' && guard < 50) {
        guard += 1;
        const next = dealNextInitialCard(state.session, state.players, state.deck, state.round, settings, protocol);
        state = {
            session: next.session,
            players: next.players,
            deck: next.deck,
            round: next.round,
        };
    }
    return state;
}
