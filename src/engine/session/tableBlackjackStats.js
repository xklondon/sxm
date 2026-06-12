import { parseBlackjackHandKey } from '../blackjack/handKeys';

function resolveBoxSlotNumber(state, boxPlayerId) {
    const fromSession = state.session.boxSlotNumbers?.[boxPlayerId];
    if (fromSession) {
        return fromSession;
    }
    const slot = state.tableMeta.boxSlots.find((entry) => entry.playerId === boxPlayerId);
    return slot?.slotNumber ?? null;
}

/** Increment per-box blackjack-win counts when a round settles. */
export function incrementBlackjackCountsOnSettlement(state, round) {
    const prior = state.tableMeta.blackjackCountBySlot ?? {};
    const nextCounts = { ...prior };
    let changed = false;
    for (const [handKey, outcome] of Object.entries(round.outcomes ?? {})) {
        if (outcome !== 'blackjack-win') {
            continue;
        }
        const { playerId } = parseBlackjackHandKey(handKey);
        const slot = resolveBoxSlotNumber(state, playerId);
        if (!slot) {
            continue;
        }
        nextCounts[slot] = (nextCounts[slot] ?? 0) + 1;
        changed = true;
    }
    if (!changed) {
        return state.tableMeta;
    }
    return {
        ...state.tableMeta,
        blackjackCountBySlot: nextCounts,
    };
}

export function formatBlackjackCountByBoxLabel(counts, slotNumbers) {
    const slots = [...new Set([...slotNumbers, ...Object.keys(counts ?? {}).map(Number)])].sort((a, b) => a - b);
    if (slots.length === 0) {
        return '—';
    }
    return slots.map((slot) => `Box ${slot}: ${counts?.[slot] ?? 0}`).join(', ');
}
