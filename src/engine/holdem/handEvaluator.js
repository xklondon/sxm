const CATEGORY_RANK = {
    'royal-flush': 10,
    'straight-flush': 9,
    'four-of-a-kind': 8,
    'full-house': 7,
    flush: 6,
    straight: 5,
    'three-of-a-kind': 4,
    'two-pair': 3,
    'one-pair': 2,
    'high-card': 1,
};
const RANK_VALUE = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
};
function cardValue(card) {
    return RANK_VALUE[card.rank];
}
function combinations(items, size) {
    if (size === 0) {
        return [[]];
    }
    if (items.length < size) {
        return [];
    }
    const [first, ...rest] = items;
    const withFirst = combinations(rest, size - 1).map((combo) => [first, ...combo]);
    const withoutFirst = combinations(rest, size);
    return [...withFirst, ...withoutFirst];
}
function isStraight(values) {
    const unique = [...new Set(values)].sort((a, b) => b - a);
    if (unique.length < 5) {
        return null;
    }
    for (let i = 0; i <= unique.length - 5; i += 1) {
        let ok = true;
        for (let j = 1; j < 5; j += 1) {
            if (unique[i + j] !== unique[i] - j) {
                ok = false;
                break;
            }
        }
        if (ok) {
            return unique[i];
        }
    }
    if (unique.includes(14) && unique.includes(5) && unique.includes(4) &&
        unique.includes(3) && unique.includes(2)) {
        return 5;
    }
    return null;
}
function rankFiveCards(cards) {
    const values = cards.map(cardValue).sort((a, b) => b - a);
    const counts = new Map();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const groups = [...counts.entries()].sort((a, b) => {
        if (b[1] !== a[1]) {
            return b[1] - a[1];
        }
        return b[0] - a[0];
    });
    const isFlush = new Set(cards.map((c) => c.suit)).size === 1;
    const straightHigh = isStraight(values);
    if (isFlush && straightHigh !== null) {
        const category = straightHigh === 14 ? 'royal-flush' : 'straight-flush';
        return {
            category,
            categoryRank: CATEGORY_RANK[category],
            tiebreak: [straightHigh],
            cards,
            label: category.replace(/-/g, ' '),
        };
    }
    if (groups[0][1] === 4) {
        return {
            category: 'four-of-a-kind',
            categoryRank: CATEGORY_RANK['four-of-a-kind'],
            tiebreak: [groups[0][0], groups[1][0]],
            cards,
            label: 'four of a kind',
        };
    }
    if (groups[0][1] === 3 && groups[1]?.[1] === 2) {
        return {
            category: 'full-house',
            categoryRank: CATEGORY_RANK['full-house'],
            tiebreak: [groups[0][0], groups[1][0]],
            cards,
            label: 'full house',
        };
    }
    if (isFlush) {
        return {
            category: 'flush',
            categoryRank: CATEGORY_RANK.flush,
            tiebreak: values,
            cards,
            label: 'flush',
        };
    }
    if (straightHigh !== null) {
        return {
            category: 'straight',
            categoryRank: CATEGORY_RANK.straight,
            tiebreak: [straightHigh],
            cards,
            label: 'straight',
        };
    }
    if (groups[0][1] === 3) {
        const kickers = groups.filter(([v]) => v !== groups[0][0]).map(([v]) => v);
        return {
            category: 'three-of-a-kind',
            categoryRank: CATEGORY_RANK['three-of-a-kind'],
            tiebreak: [groups[0][0], ...kickers],
            cards,
            label: 'three of a kind',
        };
    }
    if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
        const highPair = Math.max(groups[0][0], groups[1][0]);
        const lowPair = Math.min(groups[0][0], groups[1][0]);
        const kicker = groups.find(([, count]) => count === 1)?.[0] ?? 0;
        return {
            category: 'two-pair',
            categoryRank: CATEGORY_RANK['two-pair'],
            tiebreak: [highPair, lowPair, kicker],
            cards,
            label: 'two pair',
        };
    }
    if (groups[0][1] === 2) {
        const kickers = groups.filter(([v]) => v !== groups[0][0]).map(([v]) => v);
        return {
            category: 'one-pair',
            categoryRank: CATEGORY_RANK['one-pair'],
            tiebreak: [groups[0][0], ...kickers],
            cards,
            label: 'one pair',
        };
    }
    return {
        category: 'high-card',
        categoryRank: CATEGORY_RANK['high-card'],
        tiebreak: values,
        cards,
        label: 'high card',
    };
}
export function rankHoldemHand(cards) {
    if (cards.length !== 5) {
        throw new Error('rankHoldemHand requires exactly 5 cards');
    }
    return rankFiveCards(cards);
}
export function evaluateBestHoldemHand(holeCards, communityCards) {
    const all = [...holeCards, ...communityCards];
    if (all.length < 5) {
        throw new Error('Need at least 5 cards to evaluate Hold\'em hand');
    }
    let best = null;
    for (const combo of combinations(all, 5)) {
        const ranked = rankFiveCards(combo);
        if (!best || compareHoldemHands(ranked, best) > 0) {
            best = ranked;
        }
    }
    return best;
}
export function compareHoldemHands(handA, handB) {
    if (handA.categoryRank !== handB.categoryRank) {
        return handA.categoryRank - handB.categoryRank;
    }
    for (let i = 0; i < Math.max(handA.tiebreak.length, handB.tiebreak.length); i += 1) {
        const a = handA.tiebreak[i] ?? 0;
        const b = handB.tiebreak[i] ?? 0;
        if (a !== b) {
            return a - b;
        }
    }
    return 0;
}
export function runHandEvaluatorChecks() {
    const results = [];
    const c = (id, rank, suit) => ({ id, rank, suit });
    const royal = evaluateBestHoldemHand([c('AH', 'A', 'hearts'), c('KH', 'K', 'hearts')], [c('QH', 'Q', 'hearts'), c('JH', 'J', 'hearts'), c('10H', '10', 'hearts')]);
    results.push(royal.category === 'royal-flush' ? 'pass: royal flush' : 'fail: royal flush');
    const pair = evaluateBestHoldemHand([c('AS', 'A', 'spades'), c('AD', 'A', 'diamonds')], [c('2C', '2', 'clubs'), c('7H', '7', 'hearts'), c('9S', '9', 'spades')]);
    results.push(pair.category === 'two-pair' || pair.category === 'one-pair'
        ? 'pass: pair detection'
        : 'fail: pair detection');
    const cmp = compareHoldemHands(evaluateBestHoldemHand([c('AS', 'A', 'spades'), c('KS', 'K', 'spades')], [c('QS', 'Q', 'spades'), c('JS', 'J', 'spades'), c('9S', '9', 'spades')]), evaluateBestHoldemHand([c('2D', '2', 'diamonds'), c('3D', '3', 'diamonds')], [c('4D', '4', 'diamonds'), c('5D', '5', 'diamonds'), c('7H', '7', 'hearts')]));
    results.push(cmp > 0 ? 'pass: flush beats straight' : 'fail: hand comparison');
    const passed = results.every((r) => r.startsWith('pass'));
    return { passed, results };
}
