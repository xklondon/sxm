import { buildInitialDealPlanFromHandKeys } from '../initialDeal';
import { cardsFromIds, getBlackjackHandValue } from '../hand';
import { getCardDealDelayMs } from '../flowSettings';
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
/** Player controls may enable before the full table reveal finishes (natural dealing). */
export function isActionRevealReady(naturalDealing, options) {
    if (!naturalDealing) {
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
    return totalCardCount(target) > totalCardCount(visible);
}
/** Ordered initial-deal reveal while catching up the first two cards per hand. */
export function shouldUseOrderedInitialReveal(roundStatus, visible, target) {
    if (!hasPendingCardReveal(visible, target) || !isInitialDealVisibilityCounts(target)) {
        return false;
    }
    if (roundStatus === 'bank-turn' ||
        roundStatus === 'banking' ||
        roundStatus === 'resolved') {
        return false;
    }
    return true;
}
/** Pick deal-speed vs bank-timer delay for the next sequential reveal step. */
export function resolveCardRevealDelayMs(state, round, roundStatus, visible, target) {
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
