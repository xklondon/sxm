/** Animation mode hooks for future dealing UX (Phase 5). */
export type DealAnimationMode = 'slide' | 'flip' | 'fast' | 'slow' | 'mix';

export const DEAL_ANIMATION_MODES: DealAnimationMode[] = [
  'slide',
  'flip',
  'fast',
  'slow',
  'mix',
];

export function resolveDealAnimationMode(
  mode: DealAnimationMode,
  random: () => number = Math.random,
): Exclude<DealAnimationMode, 'mix'> {
  if (mode !== 'mix') {
    return mode;
  }
  const baseModes: Exclude<DealAnimationMode, 'mix'>[] = [
    'slide',
    'flip',
    'fast',
    'slow',
  ];
  const index = Math.floor(random() * baseModes.length);
  return baseModes[index];
}

/** CSS class hook for PlayingCard / deal animations. */
export function getDealAnimationClass(mode: DealAnimationMode): string {
  return `deal-anim--${mode}`;
}
