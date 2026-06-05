/** Seeded PRNG (mulberry32) for deterministic shuffles. */
export function createSeededRandom(seed) {
    let state = hashSeed(seed);
    return () => {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function hashSeed(seed) {
    if (typeof seed === 'number') {
        return seed | 0;
    }
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
    }
    return hash;
}
/** Fisher-Yates shuffle (in-place on a copy). */
export function fisherYatesShuffle(items, random = Math.random) {
    const order = [...items];
    for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}
