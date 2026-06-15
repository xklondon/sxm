import { buildInitialDealPlanFromHandKeys } from '../initialDeal';
import { cardsFromIds, getBlackjackHandValue } from '../hand';
import { getCardDealDelayMs } from '../flowSettings';
import { isStagedInitialDeal } from './dealingModes';

export function emptyCardVisibility() {
    return { dealer: 0, hands: {} };
}

/** How reveal hydration should react when table/round scope changes. */
export function resolveRevealScopeTransition(previousScope, nextScope) {
    if (!previousScope) {
        return 'reset';
    }
    const prevTable = previousScope.split(':')[0] ?? '';
    const nextTable = nextScope.split(':')[0] ?? '';
    if (prevTable !== nextTable) {
        return 'hydrate';
    }
    if (previousScope !== nextScope) {
        return 'reset';
    }
    return 'continue';
}

/** True when visible counts reference a different hand set than the authoritative round. */
export function isStaleHandVisibility(visible, target) {
    for (const key of Object.keys(visible.hands)) {
        if (!(key in target.hands)) {
            return true;
        }
    }
    return false;
}

export function countVisibleCards(round) {
    if (!round) {
        return { dealer: 0, hands: {} };
    }
    const hands = {};
    for (const [handKey, hand] of Object.entries(round.playerHands)) {
        hands[handKey] = hand.cardIds.filter(Boolean).length;
    }
    return {
        dealer: round.dealerCardIds.filter(Boolean).length,
        hands,
    };
}

export function totalCardCount(counts) {
    let n = counts.dealer;
    for (const v of Object.values(counts.hands)) {
        n += v;
    }
    return n;
}

function handKeysForRound(round) {
    if (round.initialDealHandKeys?.length) {
        return round.initialDealHandKeys;
    }
    return Object.keys(round.playerHands);
}

/** True when visibility targets are still within the two-card initial deal. */
export function isInitialDealVisibilityCounts(target) {
    if (target.dealer > 2) {
        return false;
    }
    for (const count of Object.values(target.hands)) {
        if (count > 2) {
            return false;
        }
    }
    return true;
}

/** Steps to reveal when authoritative state already has all initial-deal cards. */
export function buildInitialRevealSteps(round) {
    const handKeys = handKeysForRound(round);
    const holeLast = !round.dealerCardIds[1];
    return buildInitialDealPlanFromHandKeys(handKeys, holeLast);
}

function maskRound(round, counts) {
    const playerHands = { ...round.playerHands };
    for (const [handKey, hand] of Object.entries(playerHands)) {
        const visible = counts.hands[handKey] ?? 0;
        playerHands[handKey] = {
            ...hand,
            cardIds: hand.cardIds.slice(0, visible),
        };
    }
    return {
        ...round,
        dealerCardIds: round.dealerCardIds.slice(0, counts.dealer),
        playerHands,
    };
}

export function applyCardVisibility(state, counts) {
    if (!state.blackjack) {
        return state;
    }
    return {
        ...state,
        blackjack: maskRound(state.blackjack, counts),
    };
}

/** Apply one initial-deal step onto visibility counts. */
export function applyRevealStep(counts, step) {
    if (step.type === 'dealer') {
        return { ...counts, dealer: step.cardIndex + 1 };
    }
    const prev = counts.hands[step.handKey] ?? 0;
    return {
        ...counts,
        hands: {
            ...counts.hands,
            [step.handKey]: Math.max(prev, step.cardIndex + 1),
        },
    };
}

export function countsFromRevealSteps(steps) {
    let counts = { dealer: 0, hands: {} };
    for (const step of steps) {
        counts = applyRevealStep(counts, step);
    }
    return counts;
}

export function maxVisibilityForRound(round) {
    return countVisibleCards(round);
}

export function isActiveHandRevealComplete(round, visible, handKey) {
    if (!round || !handKey) {
        return false;
    }
    const hand = round.playerHands[handKey];
    if (!hand) {
        return false;
    }
    const targetCount = hand.cardIds.filter(Boolean).length;
    if (targetCount === 0) {
        return false;
    }
    const visibleCount = visible.hands[handKey] ?? 0;
    return visibleCount >= targetCount;
}

/** Player controls may enable once the active hand or full table reveal has caught up. */
export function isActionRevealReady(pacedReveal, options) {
    if (!pacedReveal) {
        return true;
    }
    return options.cardRevealComplete || options.activeHandRevealComplete;
}

/** Stable key for per-table, per-round visual hydration. */
export function cardRevealScopeKey(sessionId, roundNumber) {
    return `${sessionId}:${roundNumber}`;
}

export function shouldHydrateCardRevealScope(previousScope, nextScope, hasHydrated) {
    return !hasHydrated || previousScope !== nextScope;
}

/** First mount on a paced table: snap only when joining mid-round (cards already in play). */
export function shouldSnapCardRevealOnMount(state) {
    if (state.tableMeta.gameStatus === 'ended') {
        return true;
    }
    const round = state.blackjack;
    if (!round) {
        return false;
    }
    const target = maxVisibilityForRound(round);
    if (totalCardCount(target) === 0) {
        return false;
    }
    if (round.status === 'bank-turn' ||
        round.status === 'banking' ||
        round.status === 'resolved') {
        return true;
    }
    if (round.status === 'player-turns' || round.insuranceOfferPending) {
        if (target.dealer > 2) {
            return true;
        }
        for (const count of Object.values(target.hands)) {
            if (count > 2) {
                return true;
            }
        }
        return false;
    }
    return false;
}

/** Reveal one gameplay card (hit, double, bank draw) toward target visibility. */
export function nextGameplayRevealStep(visible, target) {
    if (visible.dealer < target.dealer) {
        return { ...visible, dealer: visible.dealer + 1 };
    }
    const handKeys = [
        ...new Set([...Object.keys(visible.hands), ...Object.keys(target.hands)]),
    ];
    for (const handKey of handKeys) {
        const cur = visible.hands[handKey] ?? 0;
        const tgt = target.hands[handKey] ?? 0;
        if (cur < tgt) {
            return {
                ...visible,
                hands: { ...visible.hands, [handKey]: cur + 1 },
            };
        }
    }
    return null;
}

export function hasPendingCardReveal(visible, target) {
    if (isStaleHandVisibility(visible, target)) {
        return totalCardCount(target) > 0;
    }
    if (visible.dealer < target.dealer) {
        return true;
    }
    for (const [handKey, targetCount] of Object.entries(target.hands)) {
        if ((visible.hands[handKey] ?? 0) < targetCount) {
            return true;
        }
    }
    return totalCardCount(target) > totalCardCount(visible);
}

/** Ordered initial-deal reveal while catching up the first two cards per hand. */
export function shouldUseOrderedInitialReveal(_roundStatus, visible, target) {
    if (!hasPendingCardReveal(visible, target) || !isInitialDealVisibilityCounts(target)) {
        return false;
    }
    return true;
}

/** Next paced reveal step — ordered initial deal, then gameplay catch-up. */
export function nextSequentialRevealStep(visible, target, round, roundStatus) {
    if (isStaleHandVisibility(visible, target)) {
        return null;
    }
    if (round && shouldUseOrderedInitialReveal(roundStatus, visible, target)) {
        const steps = buildInitialRevealSteps(round);
        for (const step of steps) {
            const after = applyRevealStep(visible, step);
            if (after.dealer !== visible.dealer ||
                Object.keys(after.hands).some((handKey) => (after.hands[handKey] ?? 0) !== (visible.hands[handKey] ?? 0))) {
                if (totalCardCount(after) <= totalCardCount(target)) {
                    return after;
                }
            }
        }
    }
    if (hasPendingCardReveal(visible, target)) {
        return nextGameplayRevealStep(visible, target);
    }
    return null;
}

/** True when the next reveal step is the first card on a hand after another hand already has cards. */
export function isHandBoundaryRevealStep(visible, stepped) {
    for (const [handKey, nextCount] of Object.entries(stepped.hands)) {
        const prevCount = visible.hands[handKey] ?? 0;
        if (prevCount === 0 && nextCount > 0) {
            const otherHandsStarted = Object.entries(visible.hands).some(([key, count]) => key !== handKey && count > 0);
            if (otherHandsStarted) {
                return true;
            }
        }
    }
    return false;
}

/** Pick deal-speed vs bank-timer delay for the next sequential reveal step. */
export function resolveCardRevealDelayMs(state, round, roundStatus, visible, target) {
    if (isStagedInitialDeal(state.blackjackFlowSettings.initialDealMode)) {
        return 0;
    }
    if (round && shouldUseOrderedInitialReveal(roundStatus, visible, target)) {
        return getCardDealDelayMs(state, 'initial-deal');
    }
    const step = nextGameplayRevealStep(visible, target);
    if (!step) {
        return getCardDealDelayMs(state, 'initial-deal');
    }
    if (step.dealer > visible.dealer) {
        if (roundStatus === 'bank-turn' || roundStatus === 'banking') {
            return getCardDealDelayMs(state, 'bank-card-draw');
        }
        return getCardDealDelayMs(state, 'dealer');
    }
    return getCardDealDelayMs(state, 'hit');
}

/** Visible card ids for a hand in the current display round (masked or full). */
export function getVisibleHandCardIds(round, handKey) {
    return (round?.playerHands[handKey]?.cardIds ?? []).filter(Boolean);
}

/**
 * Hand total from visible cards only — totals must never lead card reveal.
 * Returns null when no visible cards exist yet.
 */
export function getDisplayedHandValue(deck, round, handKey) {
    if (!deck) {
        return null;
    }
    const ids = getVisibleHandCardIds(round, handKey);
    if (ids.length === 0) {
        return null;
    }
    return getBlackjackHandValue(cardsFromIds(deck, ids)).value;
}
