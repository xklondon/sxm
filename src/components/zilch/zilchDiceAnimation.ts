/** Visual-only dice UI phase timings (ms). Engine roll completes independently. */
export const ZILCH_THROW_MS = 1200;
export const ZILCH_LANDED_MS = 2000;
export const ZILCH_GATHER_MS = 500;

export type ZilchDiceUiPhase =
  | 'idle'
  | 'throwing'
  | 'landed'
  | 'gather'
  | 'ordered';

export function selectionEnabledForPhase(phase: ZilchDiceUiPhase): boolean {
  return phase === 'ordered';
}

export function controlsLockedForDicePhase(phase: ZilchDiceUiPhase): boolean {
  return phase === 'throwing' || phase === 'landed' || phase === 'gather';
}
