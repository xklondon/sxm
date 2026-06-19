import type { ZilchDiceAnimationSettings, ZilchGameSettings } from './zilchTypes';

export const DEFAULT_ZILCH_TARGET_POINTS = 10_000;

export const DEFAULT_ZILCH_DICE_ANIMATION: ZilchDiceAnimationSettings = {
  diceAnimationMode: 'fixed',
  diceAnimationMs: 2500,
  diceAnimationRandomMinMs: 2000,
  diceAnimationRandomMaxMs: 8000,
};

export const DEFAULT_ZILCH_SETTINGS: ZilchGameSettings = {
  mode: 'target_points',
  targetPoints: DEFAULT_ZILCH_TARGET_POINTS,
  roundLimit: 10,
  diceAnimation: { ...DEFAULT_ZILCH_DICE_ANIMATION },
};

export function resolveDiceAnimationDurationMs(
  settings: ZilchDiceAnimationSettings,
  rng: () => number = Math.random,
): number {
  if (settings.diceAnimationMode === 'random') {
    const min = settings.diceAnimationRandomMinMs;
    const max = settings.diceAnimationRandomMaxMs;
    const span = Math.max(0, max - min);
    return min + Math.floor(rng() * (span + 1));
  }
  return settings.diceAnimationMs;
}
