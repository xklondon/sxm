export const DEFAULT_ZILCH_DICE_ANIMATION = {
    diceAnimationMode: 'fixed',
    diceAnimationMs: 2500,
    diceAnimationRandomMinMs: 2000,
    diceAnimationRandomMaxMs: 8000,
};
export const DEFAULT_ZILCH_SETTINGS = {
    mode: 'target_points',
    targetPoints: 100,
    roundLimit: 10,
    diceAnimation: { ...DEFAULT_ZILCH_DICE_ANIMATION },
};
export function resolveDiceAnimationDurationMs(settings, rng = Math.random) {
    if (settings.diceAnimationMode === 'random') {
        const min = settings.diceAnimationRandomMinMs;
        const max = settings.diceAnimationRandomMaxMs;
        const span = Math.max(0, max - min);
        return min + Math.floor(rng() * (span + 1));
    }
    return settings.diceAnimationMs;
}
