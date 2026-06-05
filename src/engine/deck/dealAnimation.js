export const DEAL_ANIMATION_MODES = [
    'slide',
    'flip',
    'fast',
    'slow',
    'mix',
];
export function resolveDealAnimationMode(mode, random = Math.random) {
    if (mode !== 'mix') {
        return mode;
    }
    const baseModes = [
        'slide',
        'flip',
        'fast',
        'slow',
    ];
    const index = Math.floor(random() * baseModes.length);
    return baseModes[index];
}
/** CSS class hook for PlayingCard / deal animations. */
export function getDealAnimationClass(mode) {
    return `deal-anim--${mode}`;
}
